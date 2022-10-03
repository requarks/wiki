module.exports = async (payload) => {
  WIKI.logger.info('Checking for latest version...')

  try {
    // TODO: Fetch latest version

    WIKI.logger.info('Checked for latest version: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Checking for latest version: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
