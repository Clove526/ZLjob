import { createServer } from '../backend/src/server.js'

let appInstance

export default async function handler(req, res) {
  if (!appInstance) {
    appInstance = await createServer()
    await appInstance.ready()
  }
  appInstance.server.emit('request', req, res)
}
