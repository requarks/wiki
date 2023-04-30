import { get, has, isEmpty, reduce, times, toSafeInteger } from 'lodash-es'
import * as cheerio from 'cheerio'

export async function task ({ payload }) {
  WIKI.logger.info(`Rendering page ${payload.id}...`)

  try {
    await WIKI.ensureDb()

    const page = await WIKI.db.pages.getPageFromDb(payload.id)
    if (!page) {
      throw new Error('Invalid Page Id')
    }

    const site = await WIKI.db.sites.query().findById(page.siteId)

    await WIKI.db.renderers.fetchDefinitions()

    const pipeline = await WIKI.db.renderers.getRenderingPipeline(page.contentType)

    let output = page.render

    if (isEmpty(page.content)) {
      WIKI.logger.warn(`Failed to render page ID ${payload.id} because content was empty: [ FAILED ]`)
    }

    for (const core of pipeline) {
      const renderer = (await import(`../../modules/rendering/${core.key}/renderer.mjs`)).default
      output = await renderer.render.call({
        config: core.config,
        children: core.children,
        page,
        site,
        input: output
      })
    }

    // Parse TOC
    // const $ = cheerio.load(output)
    // let isStrict = $('h1').length > 0 // <- Allows for documents using H2 as top level
    let toc = { root: [] }

    // $('h1,h2,h3,h4,h5,h6').each((idx, el) => {
    //   const depth = toSafeInteger(el.name.substring(1)) - (isStrict ? 1 : 2)
    //   let leafPathError = false

    //   const leafPath = reduce(times(depth), (curPath, curIdx) => {
    //     if (has(toc, curPath)) {
    //       const lastLeafIdx = get(toc, curPath).length - 1
    //       if (lastLeafIdx >= 0) {
    //         curPath = `${curPath}[${lastLeafIdx}].children`
    //       } else {
    //         leafPathError = true
    //       }
    //     }
    //     return curPath
    //   }, 'root')

    //   if (leafPathError) { return }

    //   const leafSlug = $('.toc-anchor', el).first().attr('href')
    //   $('.toc-anchor', el).remove()

    //   get(toc, leafPath).push({
    //     label: $(el).text().trim(),
    //     key: leafSlug.substring(1),
    //     children: []
    //   })
    // })

    // Save to DB
    await WIKI.db.pages.query()
      .patch({
        render: output,
        toc: JSON.stringify(toc.root)
      })
      .where('id', payload.id)

    // Save to cache
    // await WIKI.db.pages.savePageToCache({
    //   ...page,
    //   render: output,
    //   toc: JSON.stringify(toc.root)
    // })

    WIKI.logger.info(`Rendered page ${payload.id}: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Rendering page ${payload.id}: [ FAILED ]`)
    WIKI.logger.error(err.message)
    throw err
  }
}
