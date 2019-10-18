const _ = require('lodash')
const cheerio = require('cheerio')

/* global WIKI */

module.exports = {
  async render() {
    const $ = cheerio.load(this.input)

    if ($.root().children().length < 1) {
      return ''
    }

    for (let child of this.children) {
      const renderer = require(`../${_.kebabCase(child.key)}/renderer.js`)
      renderer.init($, child.config)
    }

    // --------------------------------
    // Detect internal / external links
    // --------------------------------

    let internalRefs = []
    const reservedPrefixes = /^\/[a-z]\//gi

    const isHostSet = WIKI.config.host.length > 7 && WIKI.config.host !== 'http://'
    if (!isHostSet) {
      WIKI.logger.warn('Host is not set. You must set the Site Host under General in the Administration Area!')
    }

    $('a').each((i, elm) => {
      let href = $(elm).attr('href')

      // -> Ignore empty / anchor links
      if (!href || href.length < 1 || href.indexOf('#') === 0 || href.indexOf('mailto:') === 0) {
        return
      }

      // -> Strip host from local links
      if (isHostSet && href.indexOf(WIKI.config.host) === 0) {
        href = href.replace(WIKI.config.host, '')
      }

      // -> Assign local / external tag
      if (href.indexOf('://') < 0) {
        // -> Remove trailing slash
        if (_.endsWith('/')) {
          href = href.slice(0, -1)
        }

        // -> Check for system prefix
        if (!reservedPrefixes.test(href)) {
          $(elm).addClass(`is-internal-link`)

          // -> Reformat paths
          if (href.indexOf('/') !== 0) {
            href = `/${this.page.localeCode}/${this.page.path}/${href}`
          } else if (href.charAt(3) !== '/') {
            href = `/${this.page.localeCode}${href}`
          }

          // -> Save internal references
          internalRefs.push({
            localeCode: href.substring(1, 3),
            path: _.head(href.substring(4).split('#'))
          })
        } else {
          $(elm).addClass(`is-system-link`)
        }
      } else {
        $(elm).addClass(`is-external-link`)
      }

      // -> Update element
      $(elm).attr('href', href)
    })

    // --------------------------------
    // Detect internal link states
    // --------------------------------

    const pastLinks = await this.page.$relatedQuery('links')

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
        const hrefObj = {
          localeCode: href.substring(1, 3),
          path: _.head(href.substring(4).split('#'))
        }
        if (_.some(results, r => {
          return r.localeCode === hrefObj.localeCode && r.path === hrefObj.path
        })) {
          $(elm).addClass(`is-valid-page`)
        } else {
          $(elm).addClass(`is-invalid-page`)
        }
      })

      // -> Add missing links
      const missingLinks = _.differenceWith(internalRefs, pastLinks, (nLink, pLink) => {
        return nLink.localeCode === pLink.localeCode && nLink.path === pLink.path
      })
      if (missingLinks.length > 0) {
        if (WIKI.config.db.type === 'postgres') {
          await WIKI.models.pageLinks.query().insert(missingLinks.map(lnk => ({
            pageId: this.page.id,
            path: lnk.path,
            localeCode: lnk.localeCode
          })))
        } else {
          for (const lnk of missingLinks) {
            await WIKI.models.pageLinks.query().insert({
              pageId: this.page.id,
              path: lnk.path,
              localeCode: lnk.localeCode
            })
          }
        }
      }
    }

    // -> Remove outdated links
    if (pastLinks) {
      const outdatedLinks = _.differenceWith(pastLinks, internalRefs, (nLink, pLink) => {
        return nLink.localeCode === pLink.localeCode && nLink.path === pLink.path
      })
      if (outdatedLinks.length > 0) {
        await WIKI.models.pageLinks.query().delete().whereIn('id', _.map(outdatedLinks, 'id'))
      }
    }

    // --------------------------------
    // Add id to headers for navigation
    // --------------------------------

    let headerIdCounter = 0
    $('h1,h2,h3,h4,h5,h6').each((idx, el) => {
      const elmId = $(el).attr('id')
      if (elmId) return // Skip if this element already has id
      const headerId = _.split(_.toLower(_.trim($(el).text())), /\s+/).join('-') + '-' + headerIdCounter
      headerIdCounter += 1
      $(el).attr({ id: headerId })
    })

    return $.html('body').replace('<body>', '').replace('</body>', '')
  }
}
