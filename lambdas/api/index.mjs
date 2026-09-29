import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const s3 = new S3Client({})
const bedrock = new BedrockRuntimeClient({})
const imageBedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_IMAGE_REGION || 'us-west-2' })
const tableName = process.env.PROJECTS_TABLE
const assetsBucket = process.env.ASSETS_BUCKET
const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0'
const imageModelId = process.env.BEDROCK_IMAGE_MODEL_ID || 'stability.stable-image-core-v1:1'

const directionTool = {
  tools: [{ toolSpec: { name: 'create_booklet_direction', description: 'Create the complete, original art direction and page plan for one face-to-face family meeting booklet.', inputSchema: { json: {
    type: 'object', required: ['reply', 'proposal'], properties: {
      reply: { type: 'string' },
      proposal: { type: 'object', required: ['title', 'why', 'pages', 'fields', 'design'], properties: {
        title: { type: 'string' }, why: { type: 'string' }, pages: { type: 'array', items: { type: 'string' } }, fields: { type: 'object', additionalProperties: { type: 'string' } },
        design: { type: 'object', required: ['title', 'format', 'palette', 'typography', 'motif', 'artDirection', 'fields', 'pages'], properties: {
          title: { type: 'string' }, format: { type: 'string', enum: ['a5-portrait', 'a4-landscape'] }, typography: { type: 'string', enum: ['serif', 'sans', 'handwritten'] }, motif: { type: 'string' }, artDirection: { type: 'string' },
          palette: { type: 'object', required: ['paper', 'ink', 'accent', 'soft'], properties: { paper: { type: 'string' }, ink: { type: 'string' }, accent: { type: 'string' }, soft: { type: 'string' } } },
          fields: { type: 'array', items: { type: 'string' } },
          pages: { type: 'array', minItems: 4, maxItems: 8, items: { type: 'object', required: ['title', 'kind', 'layout'], properties: { title: { type: 'string' }, kind: { type: 'string', enum: ['cover', 'letter', 'memories', 'family', 'guide', 'closing'] }, layout: { type: 'string', enum: ['quiet', 'collage', 'ledger', 'postcard', 'menu', 'column'] } } } }
        } }
      } }
    }
  } } } }],
  toolChoice: { tool: { name: 'create_booklet_direction' } }
}

const assistantInstructions = `あなたは結婚の顔合わせしおりを一緒に作る、経験豊かな編集者・アートディレクターです。
ユーザーの思い出、家族、写真、会場、希望の紙ものの雰囲気を丁寧に読み取り、決まりきったテンプレートへ押し込めません。
表紙に新郎新婦の名前を大きく置くことを前提にせず、写真・余白・小さなモチーフ・言葉でその日の気配を作ります。
デザインでは情報量より、ページの役割、読む順番、写真の扱い、余白、印刷した時の佇まいを大事にします。
一度に質問しすぎず、次に決めるとよいことを一つか二つ尋ねてください。
顔合わせの食事会向けなので、ユーザーが明示しない限り、招待状、席次表、ご祝儀、宿泊、引き出物、結婚式のゲスト紹介は提案しません。ページは4〜10ページ程度に絞り、会場案内、挨拶、ふたりの思い出、プロフィール、両家紹介、当日の流れ、結びの中から必要なものだけを選びます。
既存テンプレートを選ばないでください。毎回、会話内容から新しい冊子を一冊だけ設計します。色替えや既存型の置換ではなく、紙面サイズ、配色、書体、モチーフ、余白、写真の役割、ページ順をその思い出のために決めます。
proposal.designには、title、format（a5-portrait または a4-landscape）、palette（paper, ink, accent, soft の16進カラー）、typography（serif, sans, handwritten）、motif、artDirection、fields、pagesを入れます。pagesは4〜8個で、各要素は title、kind（cover, letter, memories, family, guide, closing）、layout（quiet, collage, ledger, postcard, menu, column）を持ちます。fieldsは date, venue, address, greeting, schedule, menu, story, message, dressCode, gift, proposal, pottery, ring, futurePlan, contact, childhood, conversation から必要なものだけを選びます。
返答本文replyは200文字以内で、構成の要点と次に聞きたいことだけを書きます。JSONやtemplateIdやページ一覧をreplyに重複して書かないでください。ユーザーがアップロードしていない写真、架空のURL、勝手な日時・会の進行・家族の紹介文を作らないでください。会場・日時・住所・進行は、ユーザーが明示した値だけを使い、未確認ならproposal.fieldsから省きます。
必ず create_booklet_direction ツールを一回だけ呼び出して返してください。proposalは材料が少ない時も、仮案として作ってください。`

function response(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

function userId(event) {
  return event.requestContext?.authorizer?.jwt?.claims?.sub
}

function firstJsonObject(raw) {
  const start = raw.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = start; index < raw.length; index += 1) {
    const character = raw[index]
    if (quoted) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') quoted = false; continue }
    if (character === '"') { quoted = true; continue }
    if (character === '{') depth += 1
    if (character === '}') { depth -= 1; if (depth === 0) return raw.slice(start, index + 1) }
  }
  return null
}

function modelText(output) {
  const toolUse = output?.output?.message?.content?.find((part) => part.toolUse)?.toolUse
  if (toolUse?.input) {
    const value = toolUse.input
    const narrativeFields = new Set(['greeting', 'story', 'message', 'proposal', 'pottery', 'conversation', 'childhood'])
    const fields = Object.fromEntries(Object.entries(value.proposal?.fields || {}).filter(([key]) => narrativeFields.has(key)))
    return { ...value, proposal: { ...value.proposal, fields } }
  }
  const raw = output?.output?.message?.content?.map((part) => part.text || '').join('').trim() || ''
  const json = firstJsonObject(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, ''))
  try { return JSON.parse(json || '') } catch {
    const replyMatch = raw.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/)
    const titleMatch = raw.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/)
    const reply = replyMatch ? replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : 'いただいた思い出をもとに、まずは写真と家族紹介を大切にした構成にまとめました。'
    const title = titleMatch ? titleMatch[1].replace(/\\"/g, '"') : raw.includes('ひまわり') ? 'ひまわりの約束' : 'ふたりの思い出を綴る一冊'
    console.warn('Assistant returned malformed JSON; using safe proposal recovery')
    return { reply, proposal: { title, why: '会話から受け取った思い出と、ご家族を紹介する時間を両方大切にできる構成です。', pages: ['表紙', 'ご挨拶', 'ふたりの思い出', 'ご家族のご紹介', '当日の流れ', '結び'], fields: {} } }
  }
}

async function imageBlocks(owner, keys) {
  const allowed = Array.isArray(keys) ? keys.slice(0, 4).filter((key) => typeof key === 'string' && key.startsWith(`${owner}/`)) : []
  return Promise.all(allowed.map(async (key) => {
    const object = await s3.send(new GetObjectCommand({ Bucket: assetsBucket, Key: key }))
    const bytes = await object.Body.transformToByteArray()
    const format = key.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
    return { image: { format, source: { bytes } } }
  }))
}

export async function handler(event) {
  const owner = userId(event)
  if (!owner) return response(401, { message: 'Authentication required' })

  const projectId = event.pathParameters?.projectId
  if (event.requestContext.http.method === 'POST' && event.rawPath.endsWith('/generate-design')) {
    const body = event.body ? JSON.parse(event.body) : {}
    const design = body.design || {}
    const motif = String(design.motif || '草花と小さな旅の記憶').slice(0, 300)
    const direction = String(design.artDirection || '上質な和紙のしおりのための手描き装飾').slice(0, 600)
    const prompt = `Create one refined editorial illustration for a Japanese family meeting wedding booklet. Motif: ${motif}. Art direction: ${direction}. Soft colored pencil and transparent watercolor, tactile handmade paper, elegant quiet composition, editorial negative space, no text, no letters, no logos, no people faces, no photorealism, no border.`
    try {
      const result = await imageBedrock.send(new InvokeModelCommand({ modelId: imageModelId, contentType: 'application/json', accept: 'application/json', body: JSON.stringify({ prompt, negative_prompt: 'text, letters, typography, watermark, logo, photorealism, portrait, face, hard computer graphics, plastic texture', aspect_ratio: '1:1', output_format: 'png', seed: Math.floor(Math.random() * 4294967295) }) }))
      const payload = JSON.parse(new TextDecoder().decode(result.body))
      const image = payload.images?.[0]
      if (!image) throw new Error('No image returned')
      const key = `${owner}/generated/${randomUUID()}.png`
      await s3.send(new PutObjectCommand({ Bucket: assetsBucket, Key: key, ContentType: 'image/png', Body: Buffer.from(image, 'base64') }))
      const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: assetsBucket, Key: key }), { expiresIn: 900 })
      return response(200, { key, downloadUrl })
    } catch (error) {
      console.error('Bedrock image generation error', error)
      return response(503, { message: 'デザインアートを生成できませんでした。もう一度お試しください。' })
    }
  }
  if (event.requestContext.http.method === 'POST' && event.rawPath.endsWith('/assistant')) {
    const body = event.body ? JSON.parse(event.body) : {}
    const turns = Array.isArray(body.messages) ? body.messages.slice(-12) : []
    const messages = turns.filter((turn) => (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string').map((turn) => ({ role: turn.role, content: [{ text: turn.content.slice(0, 6000) }] }))
    while (messages[0]?.role === 'assistant') messages.shift()
    if (!messages.length) return response(400, { message: 'A message is required' })
    const images = await imageBlocks(owner, body.imageKeys)
    if (images.length) messages[messages.length - 1].content.push(...images)
    try {
      const result = await bedrock.send(new ConverseCommand({ modelId, system: [{ text: assistantInstructions }], messages, toolConfig: directionTool, inferenceConfig: { maxTokens: 900, temperature: 0.45 } }))
      return response(200, modelText(result))
    } catch (error) {
      console.error('Bedrock assistant error', error)
      return response(503, { message: '相談役を起動できませんでした。Bedrockのモデル利用を確認してから、もう一度お試しください。' })
    }
  }
  if (event.requestContext.http.method === 'POST' && event.rawPath.endsWith('/download-url')) {
    const body = event.body ? JSON.parse(event.body) : {}
    const key = String(body.key || '')
    if (!key.startsWith(`${owner}/`)) return response(403, { message: 'Invalid asset key' })
    const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: assetsBucket, Key: key }), { expiresIn: 900 })
    return response(200, { downloadUrl })
  }

  if (event.requestContext.http.method === 'POST' && event.rawPath.endsWith('/upload-url')) {
    const body = event.body ? JSON.parse(event.body) : {}
    const contentType = body.contentType
    const projectKey = String(body.projectId || '').replace(/[^a-zA-Z0-9_-]/g, '')
    const extension = contentType === 'image/png' ? 'png' : contentType === 'image/jpeg' ? 'jpg' : null
    if (!extension || !projectKey) return response(400, { message: 'Invalid image or project id' })
    const key = `${owner}/${projectKey}/${randomUUID()}.${extension}`
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: assetsBucket, Key: key, ContentType: contentType }), { expiresIn: 300 })
    return response(200, { uploadUrl, key })
  }

  if (event.requestContext.http.method === 'GET' && !projectId) {
    const result = await client.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': owner },
      ScanIndexForward: false,
    }))
    return response(200, { projects: result.Items || [] })
  }

  if (event.requestContext.http.method === 'POST' && !projectId) {
    const body = event.body ? JSON.parse(event.body) : {}
    const id = randomUUID()
    const now = new Date().toISOString()
    const item = { projectId: id, userId: owner, createdAt: now, updatedAt: now, project: body }
    await client.send(new PutCommand({ TableName: tableName, Item: item }))
    return response(201, item)
  }

  if (event.requestContext.http.method === 'PUT' && projectId) {
    const current = await client.send(new GetCommand({ TableName: tableName, Key: { projectId } }))
    if (!current.Item || current.Item.userId !== owner) return response(404, { message: 'Project not found' })
    const body = event.body ? JSON.parse(event.body) : {}
    const result = await client.send(new UpdateCommand({
      TableName: tableName,
      Key: { projectId },
      UpdateExpression: 'SET project = :project, updatedAt = :updatedAt',
      ExpressionAttributeValues: { ':project': body, ':updatedAt': new Date().toISOString() },
      ReturnValues: 'ALL_NEW',
    }))
    return response(200, result.Attributes)
  }

  if (event.requestContext.http.method === 'GET' && projectId) {
    const result = await client.send(new GetCommand({ TableName: tableName, Key: { projectId } }))
    if (!result.Item || result.Item.userId !== owner) return response(404, { message: 'Project not found' })
    return response(200, result.Item)
  }

  if (event.requestContext.http.method === 'DELETE' && projectId) {
    const current = await client.send(new GetCommand({ TableName: tableName, Key: { projectId } }))
    if (!current.Item || current.Item.userId !== owner) return response(404, { message: 'Project not found' })
    await client.send(new DeleteCommand({ TableName: tableName, Key: { projectId } }))
    return response(200, { projectId })
  }

  return response(405, { message: 'Method not allowed' })
}
