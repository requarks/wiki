/* global WIKI */

module.exports = async () => {
  WIKI.models = require('../core/db').init()
  await WIKI.configSvc.loadFromDb()
  WIKI.mail = require('../core/mail').init()
  WIKI.lang = require('../core/localization').init()
  const providers = await WIKI.models.commentProviders.query().where('key', 'default')
  const emailAddresses = providers[0].config.notificationEmailAddresses
  if (!providers[0].isEnabled || !emailAddresses) return
  const unsentComments = await WIKI.models.comments.query().select('id', 'pageId', 'name', 'email', 'content').where('notificationSent', false)
  WIKI.logger.info('Number of comments that need to be sent: ' + unsentComments.length)
  if (!unsentComments.length) return
  let listItems = ''
  for (const comment of unsentComments) {
    const page = await WIKI.models.pages.getPageFromDb(comment.pageId)
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }
    const interpolation = {
      email: comment.email,
      commentAuthorName: comment.name,
      pagePath: WIKI.config.host + '/' + page.path,
      pageTitle: page.title
    }
    listItems += '<li>' + WIKI.lang.engine.t('emails:notification-email:item', interpolation) + ':<br>' +
      comment.content

    await WIKI.models.comments.query().findById(comment.id).patch({
      notificationSent: true
    })
  }
  const subject = WIKI.lang.engine.t('emails:notification-email:subject')
  for (const to of emailAddresses.split(/, */)) {
    await WIKI.mail.send({
      template: 'comment-notification',
      to,
      subject,
      data: {
        preheadertext: WIKI.lang.engine.t('emails:notification-email:preheadertext'),
        title: subject,
        content: '<ul>' + listItems + '</ul>'
      }
    })
    WIKI.logger.info('Sent notification email to ' + to + '.')
  }
}
