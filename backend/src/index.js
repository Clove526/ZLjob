import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { gameRoutes } from './routes/game.js'

const server = Fastify({
  logger: true,
  bodyLimit: 5242880 // 5MB
})

await server.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// 请求日志中间件
server.addHook('onRequest', async (request, reply) => {
  console.log(`[${request.method}] ${request.url} | Content-Type: ${request.headers['content-type'] || 'N/A'}`)
})

// 错误处理中间件
server.setErrorHandler((error, request, reply) => {
  console.error('Fastify Error:', error.message)
  if (error.validation) {
    console.error('Validation errors:', JSON.stringify(error.validation))
  }
  reply.status(error.statusCode || 500).send({
    error: error.message,
    validation: error.validation || null
  })
})

// 404 处理
server.setNotFoundHandler((request, reply) => {
  console.log(`404: ${request.method} ${request.url}`)
  reply.status(404).send({ error: 'Not Found' })
})

server.register(gameRoutes, { prefix: '/api/game' })

server.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const start = async () => {
  try {
    const port = process.env.PORT || 3001
    await server.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()