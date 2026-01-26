const graphHelper = require('../../helpers/graph')
const renderPage = require('../../jobs/render-page')
const { ensureMail } = require('../../core/ensure-mail')

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

async function anonymizeComments(user, mentionedComments, userComments, anonymousUser) {
  const allComments = [...mentionedComments, ...userComments.map(comment => ({ commentId: comment.id }))]
  const uniqueCommentIds = [...new Set(allComments.map(comment => comment.commentId))]

  for (const commentId of uniqueCommentIds) {
    const comment = await WIKI.models.comments.query().findById(commentId)
    if (comment) {
      let updatedContent = comment.content
      let updatedRender = comment.render

      if (mentionedComments.some(mention => mention.commentId === commentId)) {
        // Anonymize mentions in both content (markdown) and render (html)
        updatedContent = anonymizeUserMentions(comment.content, 'markdown', user.email)
        updatedRender = anonymizeUserMentions(comment.render, 'html', user.email)
      }

      const updateData = {
        content: updatedContent,
        render: updatedRender
      }

      if (userComments.some(userComment => userComment.id === commentId)) {
        updateData.name = 'Anonymous User'
        updateData.email = '[deleted]'
      }

      if (userComments.some(userComment => userComment.authorId === user.id)) {
        updateData.authorId = anonymousUser.id
      }

      // Update directly in database to preserve our anonymized render
      await WIKI.models.comments.query().findById(commentId).patch(updateData)
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

async function sendWelcomeEmail(user) {
  let companyName = WIKI.config.companyName || process.env.COMPANY_NAME || 'Dummy Company'
  if (!ensureMail()) {
    WIKI.logger && WIKI.logger.warn && WIKI.logger.warn(`Mail subsystem not initialized. Skipping welcome email for ${user.email}`)
    return false
  }
  if (process.env.LOG_MAIL_DIAGNOSTICS === '1') {
    WIKI.logger?.info?.(`[mail][welcome] send attempt user=${user.email}`)
  }
  await WIKI.mail.send({
    template: 'account-welcome',
    to: user.email,
    subject: `Welcome to ${WIKI.config.title} – Let’s Get You Started!`,
    data: {
      username: user.name || 'User',
      companyName: companyName,
      mailLogoSrc: getMailLogoSource(),
      buttonLink: `${WIKI.config.host}/login`,
      buttonText: 'Login',
      userGuideLink: `${WIKI.config.host}/default/en/user-guide`,
      supportLink: `${WIKI.config.host}/default/user-guide/SupportHub`
    }
  })
  return true
}

async function sendUserAddedToGroupEmail(user, group) {
  const url = `${WIKI.config.host}`
  if (!ensureMail()) {
    WIKI.logger?.warn?.(`Mail subsystem not initialized. Skipping group add email for ${user.email} -> ${group.name}`)
    return false
  }
  try {
    if (process.env.LOG_MAIL_DIAGNOSTICS === '1') {
      WIKI.logger?.info?.(`[mail][group] send attempt user=${user.email} group=${group.name}`)
    }
    await WIKI.mail.send({
      template: 'user-added-to-group',
      to: user.email,
      subject: `You've been added to the group ${group.name}`,
      data: {
        username: user.name,
        groupName: group.name,
        groupDescription: group.description || '',
        url: url,
        mailLogoSrc: getMailLogoSource()
      }
    })
    if (process.env.LOG_MAIL_DIAGNOSTICS === '1') {
      WIKI.logger?.info?.(`[mail][group] send success user=${user.email} group=${group.name}`)
    }
    return true
  } catch (err) {
    WIKI.logger?.warn?.(`Failed to send group email to ${user.email}: ${err.message}`)
    return false
  }
}

function getMailLogoSource() {
  let mailLogoSrcValue
  if (WIKI.config?.mailLogoSrc) {
    mailLogoSrcValue = WIKI.config.mailLogoSrc
  } else if (process.env.MAIL_LOGO_SRC) {
    mailLogoSrcValue = process.env.MAIL_LOGO_SRC
  } else {
    mailLogoSrcValue = WIKI.config?.logoUrl || 'https://default-logo-url.com/logo.png'
  }
  return mailLogoSrcValue
}

/**
   * This function anonymizes user mentions in content for both markdown and HTML content types.
   * It replaces mentions of the user's email with '@AnonymousUser' in markdown,
   * and replaces HTML span elements with the mention class with plain text '@AnonymousUser'.
   * Currently, there is no mention functionality for the 'ascii' editor
   * so this function returns the original content for ascii.
   * @param {*} content - The content of the page.
   * @param {*} contentType - The content type of the page ('markdown', 'html', or 'ascii').
   * @param {*} email - The email of the user to anonymize.
   * @returns {string} Content with anonymized mentions, or the original content for ascii.
   */
function anonymizeUserMentions(content, contentType, email) {
  const _ = require('lodash')
  const cheerio = require('cheerio')
  
  if (contentType === 'markdown') {
    // Replace plain text mentions
    let result = content.replace(new RegExp(`@${_.escapeRegExp(email)}`, 'g'), '@AnonymousUser')
    
    // Also handle HTML spans that might exist in markdown (from visual editor)
    if (result.includes('<span') && result.includes('class="mention"')) {
      const $ = cheerio.load(result, { decodeEntities: false })
      $('span.mention').each((i, elm) => {
        const mentionEmail = $(elm).attr('data-mention')
        if (mentionEmail === email) {
          $(elm).replaceWith('@AnonymousUser')
        }
      })
      result = $('body').html() || result
    }
    
    return result
  } else if (contentType === 'html') {
    // Use cheerio to properly handle HTML with varying attribute orders
    // Don't wrap in html/body tags since page content is just fragments
    const $ = cheerio.load(content, { 
      decodeEntities: false,
      _useHtmlParser2: true
    })
    
    let hasChanges = false
    $('span.mention').each((i, elm) => {
      const mentionEmail = $(elm).attr('data-mention')
      if (mentionEmail === email) {
        $(elm).replaceWith('@AnonymousUser')
        hasChanges = true
      }
    })
    
    // Only return modified content if we actually made changes
    if (!hasChanges) {
      return content
    }
    
    // Get the HTML without the wrapper tags
    const bodyContent = $('body').html()
    if (bodyContent !== null) {
      return bodyContent
    }
    
    // Fallback: try to get root HTML if there's no body tag
    return $.html()
  }
  return content
}

async function assignUserToGroup(userId, groupId) {
  // Add the user to the group
  await graphHelper.addUserToGroup(userId, groupId)

  // Fetch user and group details
  const user = await graphHelper.getUserById(userId)
  const group = await graphHelper.getGroupById(groupId)

  // Send notification email to the user
  await sendUserAddedToGroupEmail(user, group)
}

module.exports = {
  revokeUserTokens,
  renderMentionedPages,
  renderMentionedPagesWithoutScheduler,
  anonymizeComments,
  handleDeleteError,
  sendWelcomeEmail,
  sendUserAddedToGroupEmail,
  anonymizeUserMentions,
  getMailLogoSource,
  assignUserToGroup
}
