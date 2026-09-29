import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const s3 = new S3Client({})
const tableName = process.env.PROJECTS_TABLE
const assetsBucket = process.env.ASSETS_BUCKET

function response(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

function userId(event) {
  return event.requestContext?.authorizer?.jwt?.claims?.sub
}

export async function handler(event) {
  const owner = userId(event)
  if (!owner) return response(401, { message: 'Authentication required' })

  const projectId = event.pathParameters?.projectId
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
