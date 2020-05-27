const md = require('markdown-it')
const mdEmoji = require('markdown-it-emoji')
const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')
const _ = require('lodash')
const { AkismetClient } = require('akismet-api')

/* global WIKI */

const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

md.use(mdEmoji)

let akismetClient = null

// ------------------------------------
// Default Comment Provider
// ------------------------------------

module.exports = {
  /**
   * Init
   */
  async init (config) {
    if (WIKI.data.commentProvider.config.akismet && WIKI.data.commentProvider.config.akismet.length > 2) {
      akismetClient = new AkismetClient({
        key: WIKI.data.commentProvider.config.akismet,
        blog: WIKI.config.host,
        lang: WIKI.config.lang.namespacing ? WIKI.config.lang.namespaces.join(', ') : WIKI.config.lang.code,
        charset: 'UTF-8'
      })
      try {
        const isValid = await akismetClient.verifyKey()
        if (!isValid) {
          WIKI.logger.warn('Akismet Key is invalid!')
        }
      } catch (err) {
        WIKI.logger.warn('Unable to verify Akismet Key: ' + err.message)
      }
    } else {
      akismetClient = null
    }
  },
  /**
   * Create New Comment
   */
  async create ({ page, replyTo, content, user }) {
    // -> Render Markdown
    const mkdown = md({
      html: false,
      breaks: true,
      linkify: true,
      highlight(str, lang) {
        return `<pre><code class="language-${lang}">${_.escape(str)}</code></pre>`
      }
    })

    // -> Build New Comment
    const newComment = {
      content,
      render: DOMPurify.sanitize(mkdown.render(content)),
      replyTo,
      pageId: page.id,
      authorId: user.id,
      name: user.name,
      email: user.email,
      ip: user.ip
    }

    // Check for Spam with Akismet
    if (akismetClient) {
      let userRole = 'user'
      if (user.groups.indexOf(1) >= 0) {
        userRole = 'administrator'
      } else if (user.groups.indexOf(2) >= 0) {
        userRole = 'guest'
      }

      let isSpam = false
      try {
        isSpam = await akismetClient.checkSpam({
          ip: user.ip,
          useragent: user.agentagent,
          content,
          name: user.name,
          email: user.email,
          permalink: `${WIKI.config.host}/${page.localeCode}/${page.path}`,
          permalinkDate: page.updatedAt,
          type: (replyTo > 0) ? 'reply' : 'comment',
          role: userRole
        })
      } catch (err) {
        WIKI.logger.warn('Akismet Comment Validation: [ FAILED ]')
        WIKI.logger.warn(err)
      }

      if (isSpam) {
        throw new Error('Comment was rejected because it is marked as spam.')
      }
    }

    // Save Comment
    await WIKI.models.comments.query().insert(newComment)
  },
  async update ({ id, content, user, ip }) {

  },
  async remove ({ id, user, ip }) {

  },
  async count ({ pageId }) {

  }
}
