import 'dotenv/config'
import { createServer } from './server.js'

const start = async () => {
  const app = await createServer()
  try {
    const port = process.env.PORT || 3001
    await app.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
