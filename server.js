const { Server, Probot } = require('probot')
const app = require('./app')

require('dotenv').config()
const { env } = process
const appId = env.APP_ID
const privateKey = env.PRIVATE_KEY
const secret = env.WEBHOOK_SECRET

const server = new Server({
  Probot: Probot.defaults({ appId, privateKey, secret })
})

server.expressApp.set('trust proxy', true)
server.load(app)
server.start()
