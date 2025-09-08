require('../index')
setTimeout(() => {
  require('./send-script-user-welcome-emails')()
    .then(() => {
      console.log('Job finished')
      process.exit(0)
    })
    .catch(err => {
      console.error('Job failed:', err)
      process.exit(1)
    })
}, 5000) // wait 5 seconds
