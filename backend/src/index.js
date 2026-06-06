import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { gameRoutes } from './routes/game.js'

const server = Fastify({ logger: true })

await server.register(cors, { origin: true })

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