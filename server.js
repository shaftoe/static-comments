const { Server, createProbot } = require('probot')
const app = require('./app')

const server = new Server({
  Probot: createProbot
})

server.expressApp.set('trust proxy', true)
server.load(app)
server.start()
