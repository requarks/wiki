const graphHelper = require('../../helpers/graph')

/* global WIKI */

async function revokeUserTokens(userId) {
  WIKI.auth.revokeUserTokens({ id: userId, kind: 'u' })
  WIKI.events.outbound.emit('addAuthRevoke', { id: userId, kind: 'u' })
}

async function renderMentionedPages(mentionedPages) {
  for (const pageMention of mentionedPages) {
    const page = await WIKI.models.pages.query().findById(pageMention.pageId)
    await WIKI.models.pages.renderPage(page)
  }
}

async function anonymizeComments(user, mentionedComments, userComments) {
  const allComments = [...mentionedComments, ...userComments.map(comment => ({ commentId: comment.id }))]
  const uniqueCommentIds = [...new Set(allComments.map(comment => comment.commentId))]

  for (const commentId of uniqueCommentIds) {
    const comment = await WIKI.models.comments.query().findById(commentId)
    if (comment) {
      const page = await WIKI.models.pages.query().findById(comment.pageId)
      let updatedContent = comment.content

      if (mentionedComments.some(mention => mention.commentId === commentId)) {
        updatedContent = updatedContent.replace(new RegExp(`@${user.email}`, 'g'), '@AnonymousUser')
      }

      const updateData = {
        id: comment.id,
        content: updatedContent,
        page: page
      }

      if (userComments.some(userComment => userComment.id === commentId)) {
        updateData.name = 'Anonymous User'
        updateData.email = '[deleted]'
      }

      await WIKI.data.commentProvider.update(updateData)
    }
  }
}

function handleDeleteError(err) {
  if (err.message.indexOf('foreign') >= 0) {
    return graphHelper.generateError(new WIKI.Error.UserDeleteForeignConstraint())
  } else {
    return graphHelper.generateError(err)
  }
}

module.exports = {
  revokeUserTokens,
  renderMentionedPages,
  anonymizeComments,
  handleDeleteError
}
