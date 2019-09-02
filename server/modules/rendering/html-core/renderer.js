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

      // -> Ignore empty links
      if (!href || href.length < 1) {
        return
      }

      // -> Strip host from local links
      if (isHostSet && href.indexOf(WIKI.config.site.host) === 0) {
        href = href.replace(WIKI.config.site.host, '')
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

    if (internalRefs.length > 0) {
      // -> Find matching pages
      const results = await WIKI.models.pages.query().column('path', 'localeCode').where(builder => {
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
    }

    return $.html('body').replace('<body>', '').replace('</body>', '')
  }
}
