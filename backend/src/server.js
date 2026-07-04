import Fastify from 'fastify'
import cors from '@fastify/cors'
import { gameRoutes } from './routes/game.js'

export async function createServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: 5242880
  })

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  app.addHook('onRequest', async (request) => {
    console.log(`[${request.method}] ${request.url}`)
  })

  app.setErrorHandler((error, request, reply) => {
    console.error('Fastify Error:', error.message)
    reply.status(error.statusCode || 500).send({
      error: error.message,
      validation: error.validation || null
    })
  })

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: 'Not Found' })
  })

  app.register(gameRoutes, { prefix: '/api/game' })
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
