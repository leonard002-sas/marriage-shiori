import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const tableName = process.env.PROJECTS_TABLE

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
  if (event.requestContext.http.method === 'POST' && !projectId) {
    const body = event.body ? JSON.parse(event.body) : {}
    const id = randomUUID()
    const now = new Date().toISOString()
    const item = { projectId: id, userId: owner, createdAt: now, updatedAt: now, project: body }
    await client.send(new PutCommand({ TableName: tableName, Item: item }))
    return response(201, item)
  }

  if (event.requestContext.http.method === 'GET' && projectId) {
    const result = await client.send(new GetCommand({ TableName: tableName, Key: { projectId } }))
    if (!result.Item || result.Item.userId !== owner) return response(404, { message: 'Project not found' })
    return response(200, result.Item)
  }

  return response(405, { message: 'Method not allowed' })
}
