const _ = require('lodash')
const cheerio = require('cheerio')
const uslug = require('uslug')
const pageHelper = require('../../../helpers/page')
const URL = require('url').URL
const { inactivityThresholdDate } = require('../../../helpers/dateHelpers')

const mustacheRegExp = /(\{|&#x7b;?){2}(.+?)(\}|&#x7d;?){2}/i

/* global WIKI */

// --------------------------------
// Detect internal / external links
// --------------------------------
function processLinks($, context) {
  const reservedPrefixes = /^\/[a-z]\//i
  const exactReservedPaths = /^\/[a-z]$/i
  const isHostSet = WIKI.config.host.length > 7 && WIKI.config.host !== 'http://'
  if (!isHostSet) {
    WIKI.logger.warn('Host is not set. You must set the Site Host under General in the Administration Area!')
  }

  // -> Ignore empty / anchor links, e-mail addresses, and telephone numbers
  function shouldIgnoreHref(href) {
    return !href || href.length < 1 || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')
  }

  // -> Strip host from local links
  function stripHost(href) {
    if (isHostSet && href.indexOf(`${WIKI.config.host}/`) === 0) {
      return href.replace(WIKI.config.host, '')
    }
    return href
  }

  // -> Reformat paths
  function reformatHref(href, context) {
    function buildNamespacedPath(href, context) {
      if (context.config.absoluteLinks) {
        return `/${context.page.localeCode}/${href}`
      }
      if (context.page.path === 'home') {
        return `/${context.page.localeCode}/${href}`
      }
      return `/${context.page.localeCode}/${context.page.path}/${href}`
    }

    function buildNonNamespacedPath(href, context) {
      if (context.config.absoluteLinks) {
        return `/${href}`
      }
      if (context.page.path === 'home') {
        return `/${href}`
      }

      return `/${context.page.path}/${href}`
    }

    if (WIKI.config.lang.namespacing) {
      if (!href.startsWith('/')) {
        href = buildNamespacedPath(href, context)
      } else if (href.charAt(3) !== '/') {
        href = `/${context.page.localeCode}${href}`
      }
    } else if (!href.startsWith('/')) {
      href = buildNonNamespacedPath(href, context)
    }
    return href
  }

  // -> Parse page path
  function getPagePath(href) {
    try {
      const parsedUrl = new URL(`http://x${href}`)
      return pageHelper.parsePath(parsedUrl.pathname)
    } catch (err) {
      return null
    }
  }

  // -> Check for system prefix
  function addLinkClass($elm, href) {
    if (reservedPrefixes.test(href) || exactReservedPaths.test(href)) {
      $elm.addClass('is-system-link')
    } else if (href.indexOf('.') >= 0) {
      $elm.addClass('is-asset-link')
    } else {
      $elm.addClass('is-internal-link')
    }
  }

  // -> Assign local / external tag
  function handleExternalLink($elm, context) {
    $elm.addClass('is-external-link')
    if (context.config.openExternalLinkNewTab) {
      $elm.attr('target', '_blank')
      $elm.attr('rel', context.config.relAttributeExternalLink)
    }
  }

  let internalRefs = []
  $('a').each((i, elm) => {
    let href = $(elm).attr('href')
    // -> Ignore empty / anchor links, e-mail addresses, and telephone numbers
    if (shouldIgnoreHref(href)) return
    // -> Strip host from local links
    href = stripHost(href)
    // -> Assign local / external tag
    if (href.indexOf('://') < 0) {
      // -> Reformat paths
      if (_.endsWith(href, '/')) {
        href = href.slice(0, -1)
      }
      href = reformatHref(href, context)
      let pagePath = getPagePath(href)
      if (!pagePath) return
      // -> Save internal references
      internalRefs.push({
        localeCode: pagePath.locale,
        path: pagePath.path
      })
      // -> Check for system prefix
      addLinkClass($(elm), href)
    } else {
      handleExternalLink($(elm), context)
    }
    // -> Update element
    $(elm).attr('href', href)
  })
  return internalRefs
}

// --------------------------------
// Detect internal link states
// --------------------------------
async function processInternalLinkStates($, internalRefs, context) {
  const pastLinks = await context.page.$relatedQuery('links')
  if (internalRefs.length > 0) {
    // -> Find matching pages
    const results = await WIKI.models.pages.query().column('id', 'path', 'localeCode').where(builder => {
      internalRefs.forEach((ref, idx) => {
        if (idx < 1) {
          builder.where(ref)
        } else {
          builder.orWhere(ref)
        }
      })
    })
    // -> Apply tag to internal links for found pages
    $('a.is-internal-link').each((i, elm) => {
      const href = $(elm).attr('href')
      let hrefObj = {}
      try {
        const parsedUrl = new URL(`http://x${href}`)
        hrefObj = pageHelper.parsePath(parsedUrl.pathname)
      } catch (err) {
        return
      }
      if (_.some(results, r => r.localeCode === hrefObj.locale && r.path === hrefObj.path)) {
        $(elm).addClass(`is-valid-page`)
      } else {
        $(elm).addClass(`is-invalid-page`)
      }
    })
    // -> Add missing links
    const missingLinks = _.differenceWith(internalRefs, pastLinks, (nLink, pLink) => nLink.localeCode === pLink.localeCode && nLink.path === pLink.path)
    if (missingLinks.length > 0) {
      if (WIKI.config.db.type === 'postgres') {
        await WIKI.models.pageLinks.query().insert(missingLinks.map(lnk => ({
          pageId: context.page.id,
          path: lnk.path,
          localeCode: lnk.localeCode
        })))
      } else {
        for (const lnk of missingLinks) {
          await WIKI.models.pageLinks.query().insert({
            pageId: context.page.id,
            path: lnk.path,
            localeCode: lnk.localeCode
          })
        }
      }
    }
  }
  // -> Remove outdated links
  if (pastLinks) {
    const outdatedLinks = _.differenceWith(pastLinks, internalRefs, (nLink, pLink) => nLink.localeCode === pLink.localeCode && nLink.path === pLink.path)
    if (outdatedLinks.length > 0) {
      await WIKI.models.pageLinks.query().delete().whereIn('id', _.map(outdatedLinks, 'id'))
    }
  }
}

// --------------------------------
// Detect mentions
// --------------------------------
async function processMentions($, context) {
  // -> Collect mentions from DOM
  function collectMentions($) {
    let mentions = []
    $('span.mention').each((i, elm) => {
      const mention = $(elm).text().replace(/^@/, '')
      if (mention !== 'AnonymousUser') {
        mentions.push(mention)
      }
    })
    // Remove duplicate and undefined mentions
    return _.uniq(_.compact(mentions))
  }

  // -> Add new mentions to the database
  async function addNewMentions(users, existingMentions, context) {
    const newMentions = users.filter(user => !existingMentions.some(m => m.userId === user.id)).map(user => ({
      pageId: context.page.id,
      userId: user.id
    }))
    if (newMentions.length > 0) {
      await WIKI.models.userMentions.query().insert(newMentions)
    }
  }

  // -> Remove outdated mentions from the database
  async function removeOutdatedMentions(existingMentions, mentions) {
    const userIds = existingMentions.map(m => m.userId)
    const usersMap = (await WIKI.models.users.query().whereIn('id', userIds)).reduce((usersMap, user) => {
      usersMap[user.id] = user
      return usersMap
    }, {})
    const filteredOutdatedMentions = existingMentions.filter(m => {
      const user = usersMap[m.userId]
      if (user) {
        return !mentions.includes(`${user.email}`)
      } else {
        return true
      }
    })
    if (filteredOutdatedMentions.length > 0) {
      await WIKI.models.userMentions.query().delete().whereIn('id', filteredOutdatedMentions.map(m => m.id))
    }
  }

  // -> Anonymize mentioned users if they are deleted or inactive for 3+ months
  async function getMentionsToAnonymize(mentions, context) {
    const usersForMentions = await WIKI.models.users.query().whereIn('email', mentions)
    const usersByEmail = usersForMentions.reduce((map, user) => {
      map[user.email] = user
      return map
    }, {})
    const userIdsForMentions = usersForMentions.map(u => u.id)
    let inactivityEntriesByUserId = {}
    if (userIdsForMentions.length > 0) {
      const inactivityEntries = await WIKI.models.userSiteInactivity.query().whereIn('userId', userIdsForMentions).andWhere('siteId', context.page.siteId)
      inactivityEntriesByUserId = inactivityEntries.reduce((map, entry) => {
        map[entry.userId] = entry
        return map
      }, {})
    }
    const threeMonthsAgo = inactivityThresholdDate()
    const mentionsToAnonymize = []
    for (const mention of mentions) {
      const user = usersByEmail[mention]
      let shouldAnonymize = false
      if (!user) {
        shouldAnonymize = true
      } else {
        const inactivityEntry = inactivityEntriesByUserId[user.id]
        if (inactivityEntry && new Date(inactivityEntry.inactiveSince) < threeMonthsAgo) {
          shouldAnonymize = true
        }
      }
      if (shouldAnonymize) {
        mentionsToAnonymize.push(mention)
      }
    }
    return mentionsToAnonymize
  }

  // -> Update DOM and content for anonymized mentions
  function anonymizeMentionsInDomAndContent($, mentionsToAnonymize, context) {
    if (mentionsToAnonymize.length > 0) {
      const mentionsSet = new Set(mentionsToAnonymize)
      $('span.mention').each((i, elm) => {
        const mentionEmail = $(elm).attr('data-mention')
        // Check both the data-mention attribute and the text content
        const mentionText = $(elm).text().replace(/^@/, '')
        if (mentionsSet.has(mentionEmail) || mentionsSet.has(mentionText)) {
          // Replace the entire span with plain text @AnonymousUser
          $(elm).replaceWith('@AnonymousUser')
        }
      })
      if (context.page.contentType === 'markdown') {
        const regex = new RegExp('@(' + mentionsToAnonymize.map(m => _.escapeRegExp(m)).join('|') + ')', 'g')
        context.page.content = context.page.content.replace(regex, '@AnonymousUser')
      } else if (context.page.contentType === 'html') {
        const $content = cheerio.load(context.page.content, { decodeEntities: false })
        $content('span.mention').each((i, elm) => {
          const mentionEmail = $content(elm).attr('data-mention')
          const mentionText = $content(elm).text().replace(/^@/, '')
          if (mentionsSet.has(mentionEmail) || mentionsSet.has(mentionText)) {
            $content(elm).replaceWith('@AnonymousUser')
          }
        })
        context.page.content = $content('body').html() || context.page.content
      }
    }
  }

  // -> Remove highlighting from AnonymousUser mentions
  function removeAnonymousUserHighlighting($, context) {
    // Update DOM
    $('span.mention').each((i, elm) => {
      const mentionEmail = $(elm).attr('data-mention')
      const mentionText = $(elm).text().replace(/^@/, '')
      // Remove highlighting from @AnonymousUser and deleted@deleted.deleted
      if (mentionEmail === 'AnonymousUser' || mentionText === 'AnonymousUser' || mentionText === 'deleted@deleted.deleted') {
        $(elm).replaceWith('@AnonymousUser')
      }
    })

    // Update stored content for both HTML and Markdown
    if (context.page.contentType === 'markdown') {
      // For markdown, replace any mention spans with plain text
      context.page.content = context.page.content
        .replace(/<span[^>]*class="mention"[^>]*data-mention="AnonymousUser"[^>]*>@AnonymousUser<\/span>/gi, '@AnonymousUser')
        .replace(/<span[^>]*data-mention="AnonymousUser"[^>]*class="mention"[^>]*>@AnonymousUser<\/span>/gi, '@AnonymousUser')
        .replace(/<span[^>]*class="mention"[^>]*>@AnonymousUser<\/span>/gi, '@AnonymousUser')
        .replace(/<span[^>]*class="mention"[^>]*>@deleted@deleted\.deleted<\/span>/gi, '@AnonymousUser')
    } else if (context.page.contentType === 'html') {
      // For HTML/visual editor, remove span tags around AnonymousUser
      context.page.content = context.page.content
        .replace(/<span[^>]*class="mention"[^>]*data-mention="AnonymousUser"[^>]*>@AnonymousUser<\/span>/gi, '@AnonymousUser')
        .replace(/<span[^>]*data-mention="AnonymousUser"[^>]*class="mention"[^>]*>@AnonymousUser<\/span>/gi, '@AnonymousUser')
        .replace(/<span[^>]*class="mention"[^>]*>@AnonymousUser<\/span>/gi, '@AnonymousUser')
    }
  }

  // Main logic
  let mentions = collectMentions($)
  const existingMentions = await context.page.$relatedQuery('mentions')
  const users = await WIKI.models.users.query().whereIn('email', mentions)
  await addNewMentions(users, existingMentions, context)
  await removeOutdatedMentions(existingMentions, mentions)
  const mentionsToAnonymize = await getMentionsToAnonymize(mentions, context)
  anonymizeMentionsInDomAndContent($, mentionsToAnonymize, context)
  removeAnonymousUserHighlighting($, context)
}

// --------------------------------
// Add header handles
// --------------------------------
function addHeaderHandles($) {
  let headers = []
  const headerNodes = $('h1,h2,h3,h4,h5,h6').toArray()
  for (const elm of headerNodes) {
    let headerSlug = uslug($(elm).text())
    // -> If custom ID is defined, try to use that instead
    if ($(elm).attr('id')) {
      headerSlug = $(elm).attr('id')
    }
    // -> Cannot start with a number (CSS selector limitation)
    if (headerSlug.match(/^\d/)) {
      headerSlug = `h-${headerSlug}`
    }
    // -> Make sure header is unique
    if (headers.indexOf(headerSlug) >= 0) {
      let isUnique = false
      let hIdx = 1
      while (!isUnique) {
        const headerSlugTry = `${headerSlug}-${hIdx}`
        if (headers.indexOf(headerSlugTry) < 0) {
          isUnique = true
          headerSlug = headerSlugTry
        }
        hIdx++
      }
    }
    // -> Add anchor
    $(elm).attr('id', headerSlug).addClass('toc-header')
    $(elm).prepend(`<a class="toc-anchor" href="#${headerSlug}">&#xB6;</a> `)
    headers.push(headerSlug)
  }
}

// --------------------------------
// Wrap non-empty root text nodes
// --------------------------------
function wrapRootTextNodes($) {
  $('body').contents().toArray().forEach(item => {
    if (item && item.type === 'text' && item.parent.name === 'body' && item.data !== `\n` && item.data !== `\r`) {
      $(item).wrap('<div></div>')
    }
  })
}

// --------------------------------
// Wrap root table nodes
// --------------------------------
function wrapRootTableNodes($) {
  $('body').contents().toArray().forEach(item => {
    if (item && item.name === 'table' && item.parent.name === 'body') {
      $(item).wrap('<div class="table-container"></div>')
    }
  })
}

// --------------------------------
// Escape mustache expresions
// --------------------------------
function escapeMustacheExpressions($) {
  function iterateMustacheNode(node) {
    $(node).contents().each((idx, item) => {
      if (item && item.type === 'text') {
        const rawText = $(item).text().replace(/\r?\n|\r/g, '')
        if (mustacheRegExp.test(rawText)) {
          if (!item.parent || item.parent.name === 'body') {
            $(item).wrap($('<p>').attr('v-pre', true))
          } else {
            $(item).parent().attr('v-pre', true)
          }
        }
      } else {
        iterateMustacheNode(item)
      }
    })
  }
  iterateMustacheNode($.root())
  $('pre').each((idx, elm) => {
    $(elm).attr('v-pre', true)
  })
}

module.exports = {
  async render() {
    let $ = cheerio.load(this.input, { decodeEntities: true })
    if ($.root().children().length < 1) return ''

    // --------------------------------
    // STEP: PRE
    // --------------------------------
    for (let child of _.reject(this.children, ['step', 'post'])) {
      const renderer = require(`../${_.kebabCase(child.key)}/renderer.js`)
      await renderer.init($, child.config)
    }

    // --------------------------------
    // Detect internal / external links
    // --------------------------------
    const internalRefs = processLinks($, this)

    // --------------------------------
    // Detect internal link states
    // --------------------------------
    await processInternalLinkStates($, internalRefs, this)

    // --------------------------------
    // Detect mentions
    // --------------------------------
    await processMentions($, this)
    // Save the updated content back to the database
    await WIKI.models.pages.query().patch({ content: this.page.content }).where({ id: this.page.id })
    // --------------------------------
    // Add header handles
    // --------------------------------
    addHeaderHandles($)

    // --------------------------------
    // Wrap non-empty root text nodes
    // --------------------------------
    wrapRootTextNodes($)

    // --------------------------------
    // Wrap root table nodes
    // --------------------------------
    wrapRootTableNodes($)

    // --------------------------------
    // STEP: POST
    // --------------------------------
    let output = decodeEscape($.html('body').replace('<body>', '').replace('</body>', ''))
    for (let child of _.sortBy(_.filter(this.children, ['step', 'post']), ['order'])) {
      const renderer = require(`../${_.kebabCase(child.key)}/renderer.js`)
      output = await renderer.init(output, child.config)
    }

    // --------------------------------
    // Escape mustache expresions
    // --------------------------------
    $ = cheerio.load(output, { decodeEntities: true })
    escapeMustacheExpressions($)
    return decodeEscape($.html('body').replace('<body>', '').replace('</body>', ''))
  }
}

function decodeEscape(string) {
  return string.replace(/&#x([0-9a-f]{1,6});/ig, (entity, code) => {
    code = parseInt(code, 16)

    // Don't unescape ASCII characters, assuming they're encoded for a good reason
    if (code < 0x80) return entity

    return String.fromCodePoint(code)
  })
}
