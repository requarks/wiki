const _ = require('lodash')
const cheerio = require('cheerio')
const uslug = require('uslug')
const pageHelper = require('../../../helpers/page')
const URL = require('url').URL

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
    const exactReservedPaths = /^\/[a-z]$/gi

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
        if (reservedPrefixes.test(href) || exactReservedPaths.test(href)) {
          $(elm).addClass(`is-system-link`)
        } else if (href.indexOf('.') >= 0) {
          $(elm).addClass(`is-asset-link`)
        } else {
          let pagePath = null

          // -> Add locale prefix if using namespacing
          if (WIKI.config.lang.namespacing) {
            // -> Reformat paths
            if (href.indexOf('/') !== 0) {
              href = (this.page.path === 'home') ? `/${this.page.localeCode}/${href}` : `/${this.page.localeCode}/${this.page.path}/${href}`
            } else if (href.charAt(3) !== '/') {
              href = `/${this.page.localeCode}${href}`
            }

            try {
              const parsedUrl = new URL(`http://x${href}`)
              pagePath = pageHelper.parsePath(parsedUrl.pathname)
            } catch (err) {
              return
            }
          } else {
            // -> Reformat paths
            if (href.indexOf('/') !== 0) {
              href = (this.page.path === 'home') ? `/${href}` : `/${this.page.path}/${href}`
            }

            try {
              const parsedUrl = new URL(`http://x${href}`)
              pagePath = pageHelper.parsePath(parsedUrl.pathname)
            } catch (err) {
              return
            }
          }
          // -> Save internal references
          internalRefs.push({
            localeCode: pagePath.locale,
            path: pagePath.path
          })

          $(elm).addClass(`is-internal-link`)
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
        let hrefObj = {}
        try {
          const parsedUrl = new URL(`http://x${href}`)
          hrefObj = pageHelper.parsePath(parsedUrl.pathname)
        } catch (err) {
          return
        }
        if (_.some(results, r => {
          return r.localeCode === hrefObj.locale && r.path === hrefObj.path
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
    // Add header handles
    // --------------------------------

    let headers = []
    $('h1,h2,h3,h4,h5,h6').each((i, elm) => {
      if ($(elm).attr('id')) {
        return
      }
      let headerSlug = uslug($(elm).text())

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
    })

    return $.html('body').replace('<body>', '').replace('</body>', '')
  }
}
