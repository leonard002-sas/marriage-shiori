import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const s3 = new S3Client({})
const bedrock = new BedrockRuntimeClient({})
const tableName = process.env.PROJECTS_TABLE
const assetsBucket = process.env.ASSETS_BUCKET
const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0'

const assistantInstructions = `あなたは結婚の顔合わせしおりを一緒に作る、経験豊かな編集者・アートディレクターです。
ユーザーの思い出、家族、写真、会場、希望の紙ものの雰囲気を丁寧に読み取り、決まりきったテンプレートへ押し込めません。
表紙に新郎新婦の名前を大きく置くことを前提にせず、写真・余白・小さなモチーフ・言葉でその日の気配を作ります。
デザインでは情報量より、ページの役割、読む順番、写真の扱い、余白、印刷した時の佇まいを大事にします。
一度に質問しすぎず、次に決めるとよいことを一つか二つ尋ねてください。
顔合わせの食事会向けなので、ユーザーが明示しない限り、招待状、席次表、ご祝儀、宿泊、引き出物、結婚式のゲスト紹介は提案しません。ページは4〜10ページ程度に絞り、会場案内、挨拶、ふたりの思い出、プロフィール、両家紹介、当日の流れ、結びの中から必要なものだけを選びます。
既存テンプレートを選ばないでください。毎回、会話内容から新しい冊子を一冊だけ設計します。色替えや既存型の置換ではなく、紙面サイズ、配色、書体、モチーフ、余白、写真の役割、ページ順をその思い出のために決めます。
proposal.designには、title、format（a5-portrait または a4-landscape）、palette（paper, ink, accent, soft の16進カラー）、typography（serif, sans, handwritten）、motif、artDirection、fields、pagesを入れます。pagesは4〜8個で、各要素は title、kind（cover, letter, memories, family, guide, closing）、layout（quiet, collage, ledger, postcard, menu, column）を持ちます。fieldsは date, venue, address, greeting, schedule, menu, story, message, dressCode, gift, proposal, pottery, ring, futurePlan, contact, childhood, conversation から必要なものだけを選びます。
返答本文replyは200文字以内で、構成の要点と次に聞きたいことだけを書きます。JSONやtemplateIdやページ一覧をreplyに重複して書かないでください。ユーザーがアップロードしていない写真、架空のURL、勝手な日時・会の進行・家族の紹介文を作らないでください。
出力は必ず一つのJSONオブジェクトだけにしてください。コードブロック、Markdown、JSONの前後の説明文は一切禁止です。形式は {"reply":"会話文", "proposal":{"title":"構成案の名前","why":"理由","pages":["ページ名"],"fields":{"greeting":"提案文など、分かる項目だけ"},"design":{"title":"冊子名","format":"a5-portrait","palette":{"paper":"#F7F1E8","ink":"#33433E","accent":"#CC8955","soft":"#DFE9D5"},"typography":"serif","motif":"ひまわりと陶器","artDirection":"紙面の説明","fields":["greeting"],"pages":[{"title":"表紙","kind":"cover","layout":"quiet"}]}}} です。proposalは材料が少ない時も、仮案として作ってください。`

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
  if (event.requestContext.http.method === 'POST' && event.rawPath.endsWith('/assistant')) {
    const body = event.body ? JSON.parse(event.body) : {}
    const turns = Array.isArray(body.messages) ? body.messages.slice(-12) : []
    const messages = turns.filter((turn) => (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string').map((turn) => ({ role: turn.role, content: [{ text: turn.content.slice(0, 6000) }] }))
    while (messages[0]?.role === 'assistant') messages.shift()
    if (!messages.length) return response(400, { message: 'A message is required' })
    const images = await imageBlocks(owner, body.imageKeys)
    if (images.length) messages[messages.length - 1].content.push(...images)
    try {
      const result = await bedrock.send(new ConverseCommand({ modelId, system: [{ text: assistantInstructions }], messages, inferenceConfig: { maxTokens: 700, temperature: 0.35 } }))
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
