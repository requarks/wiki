const graphHelper = require('../../helpers/graph')
const renderPage = require('../../jobs/render-page')

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

async function renderMentionedPagesWithoutScheduler(mentionedPages) {
  for (const pageMention of mentionedPages) {
    const page = await WIKI.models.pages.query().findById(pageMention.pageId)
    await renderPage(page.id)
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
      await WIKI.models.userMentions.query().delete().where({ userId: user.id, pageId: comment.pageId, commentId: comment.id })
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

/**
 * This function anonymizes user mentions in content for both markdown and HTML content types.
 * It replaces mentions of the user's email with '@AnonymousUser' in markdown,
 * and replaces HTML span elements with the mention class with a generic anonymous mention.
 * Currently, there is no mention functionality for the 'ascii' editor
 * so this function returns the original content for ascii.
 * @param {*} content - The content of the page.
 * @param {*} contentType - The content type of the page ('markdown', 'html', or 'ascii').
 * @param {*} email - The email of the user to anonymize.
 * @returns {string} Content with anonymized mentions, or the original content for ascii.
 */
function anonymizeUserMentions(content, contentType, email) {
  if (contentType === 'markdown') {
    return content.replace(new RegExp(`@${email}`, 'g'), '@AnonymousUser')
  } else if (contentType === 'html') {
    return content.replace(new RegExp(`<span class="mention" data-mention="${email}">@${email}</span>`, 'g'), '<span class="mention mention-anonymous">@AnonymousUser</span>')
  }
  return content
}

module.exports = {
  revokeUserTokens,
  renderMentionedPages,
  renderMentionedPagesWithoutScheduler,
  anonymizeComments,
  handleDeleteError,
  anonymizeUserMentions
}
