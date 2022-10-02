const chalk = require('chalk')
const os = require('node:os')

module.exports = () => {
  WIKI.servers.ws.on('connection', (socket) => {
    // TODO: Validate token + permissions
    const token = socket.handshake.auth.token
    console.info(token)

    const listeners = {}

    socket.on('server:logs', () => {
      socket.emit('server:log', chalk`{greenBright Streaming logs from {bold Wiki.js} instance {yellowBright.bold ${WIKI.INSTANCE_ID}} on host {yellowBright.bold ${os.hostname()}}...}`)
      listeners.serverLogs = (msg) => {
        socket.emit('server:log', msg)
      }
      WIKI.logger.ws.addListener('log', listeners.serverLogs)
      WIKI.logger.warn(`User XYZ is streaming server logs. ( Listeners: ${WIKI.logger.ws.listenerCount('log')} )`)
    })

    socket.on('disconnect', () => {
      if (listeners.serverLogs) {
        WIKI.logger.ws.removeListener('log', listeners.serverLogs)
        delete listeners.serverLogs
      }
      WIKI.logger.warn(`User XYZ has stopped streaming server logs. ( Listeners: ${WIKI.logger.ws.listenerCount('log')} )`)
    })
  })
}
