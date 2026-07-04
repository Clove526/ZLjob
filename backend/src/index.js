import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { gameRoutes } from './routes/game.js'

export const createServer = async () => {
  const server = Fastify({
    logger: true,
    bodyLimit: 5242880 // 5MB
  })

  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  server.addHook('onRequest', async (request, reply) => {
    console.log(`[${request.method}] ${request.url} | Content-Type: ${request.headers['content-type'] || 'N/A'}`)
  })

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

  server.setNotFoundHandler((request, reply) => {
    console.log(`404: ${request.method} ${request.url}`)
    reply.status(404).send({ error: 'Not Found' })
  })

  server.register(gameRoutes, { prefix: '/api/game' })

  server.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return server
}

const start = async () => {
  try {
    const server = await createServer()
    const port = process.env.PORT || 3001
    await server.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

start()