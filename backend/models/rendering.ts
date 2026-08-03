import * as cheerio from 'cheerio'
import sanitizeHtml from 'sanitize-html'
import { eq, inArray, sql } from 'drizzle-orm'
import { jobs as jobsTable, pageRenderQueue as renderQueueTable } from '../db/schema.ts'
import { CustomError } from '../helpers/common.ts'

/**
 * Rendering model
 *
 * Markdown becomes HTML in the browser, not here: the editor renders as you type, and what it shows
 * in its preview is what gets sent up and stored. One renderer, one result — the preview cannot drift
 * from the saved page because they are the same render.
 *
 * What this model does is everything that has to happen *after* that, and cannot be left to the
 * client:
 *
 *  - **Sanitizing.** The HTML arrived from a browser, so it is a user input like any other. What
 *    survives depends on what the author is allowed to do — scripts and styles are permissions.
 *  - **Normalizing.** The editor leaves scaffolding in its output (line markers for preview scroll
 *    sync) that has no business being stored, and headings arrive without the anchors a table of
 *    contents needs.
 *  - **Extracting.** The table of contents and the plain text the search index is built from are both
 *    derived from the final HTML, once it is settled.
 *
 * Re-rendering an existing page from its source — which the server needs when the content is there
 * but the render is stale — goes back through the very same frontend pipeline, driven in a headless
 * browser. That is a job rather than part of a request: see `queuePage` and `drainQueue`.
 */

/** How long the renderer bundle gets to load itself in the headless browser, in milliseconds. */
const RENDER_READY_TIMEOUT = 30000

/** How long a single render gets once the bundle is up, in milliseconds. */
const RENDER_TIMEOUT = 30000

/** The task that drains the render queue. One browser, one page at a time. */
const DRAIN_TASK = 'renderPages'

/** A heading in the table of contents, shaped for the Quasar tree the page sidebar draws. */
export interface TocNode {
  key: string
  label: string
  /**
   * The heading's own level, 1 to 6.
   *
   * Kept alongside the nesting because the two say different things: a contents list is asked to show
   * "H1 to H2", which is about the tag an author reached for, and an `h3` written under an `h1` is
   * still an `h3` however few levels sit above it.
   */
  level: number
  children: TocNode[]
}

export interface PostProcessResult {
  /** The HTML to store and serve. */
  render: string
  /** The table of contents, derived from the headings. */
  toc: TocNode[]
  /** Plain text, for the search index. */
  text: string
}

/**
 * A headless browser standing by on the renderer bundle, good for any number of pages.
 *
 * Opening one is the expensive part of rendering, so it is handed out as a handle to be reused and
 * closed by whoever asked for it rather than opened per page.
 */
interface PageRenderer {
  /** Markdown in, the editor's own HTML out — before `postProcess` gets to it. */
  render(content: string, config: Record<string, any>): Promise<string>
  close(): Promise<void>
}

/** What the author is allowed to put in a page, beyond ordinary content. */
export interface RenderPermissions {
  /** `write:scripts` — may embed `<script>` and inline event handlers. */
  scripts: boolean
  /** `write:styles` — may embed `<style>` and inline `style` attributes. */
  styles: boolean
}

/**
 * Tags and attributes a page may use whoever wrote it.
 *
 * Deliberately broad: this is a wiki, the markdown renderer is configured with `allowHTML` on by
 * default, and authors are expected to reach for raw HTML. The line being drawn is not "what looks
 * like a document" but "what can execute" — those are the permission-gated parts below.
 */
const BASE_ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  'abbr',
  'audio',
  'button',
  'del',
  'details',
  'figcaption',
  'figure',
  'img',
  'ins',
  'kbd',
  'mark',
  'picture',
  'section',
  'source',
  'sub',
  'summary',
  'sup',
  'track',
  'u',
  'video',
  // -> KaTeX renders to MathML alongside its HTML fallback
  'annotation',
  'math',
  'menclose',
  'mfrac',
  'mi',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mphantom',
  'mroot',
  'mrow',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msubsup',
  'msup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'munder',
  'munderover',
  'semantics',
  // -> Inline SVG, which an author may well paste in. Structure and shapes only: `script`,
  //    `foreignObject` and the SMIL animation tags are all left out, since each of them is a way to
  //    get script or arbitrary markup back in through a picture.
  'svg',
  'circle',
  'clipPath',
  'defs',
  'desc',
  'ellipse',
  'g',
  'line',
  'linearGradient',
  'marker',
  'mask',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'stop',
  'symbol',
  'text',
  'tspan',
  'use'
]

/** Presentation attributes shared across the SVG subset above. None of them can execute. */
const SVG_ATTRIBUTES = [
  'clip-path',
  'clip-rule',
  'cx',
  'cy',
  'd',
  'fill',
  'fill-opacity',
  'fill-rule',
  'height',
  'href',
  'mask',
  'offset',
  'opacity',
  'points',
  'preserveAspectRatio',
  'r',
  'rx',
  'ry',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'transform',
  'viewBox',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2'
]

const BASE_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  // -> `style` is here rather than behind `write:styles` because the renderer itself produces it:
  //    KaTeX sizes and positions every piece of a formula with inline styles, and math would come
  //    out mangled for any author without the permission. The permission gates the `<style>` tag,
  //    which is where a page can restyle everything around it.
  '*': ['id', 'class', 'style', 'title', 'dir', 'lang', 'aria-*', 'role', 'data-*'],
  a: ['href', 'name', 'target', 'rel', 'download'],
  audio: ['controls', 'loop', 'muted', 'preload', 'src'],
  img: ['src', 'srcset', 'alt', 'width', 'height', 'loading', 'decoding'],
  input: ['type', 'checked', 'disabled'],
  ol: ['start', 'reversed', 'type'],
  source: ['src', 'srcset', 'type', 'media'],
  td: ['colspan', 'rowspan', 'align'],
  th: ['colspan', 'rowspan', 'align', 'scope'],
  track: ['src', 'kind', 'srclang', 'label', 'default'],
  video: ['controls', 'loop', 'muted', 'poster', 'preload', 'src', 'width', 'height'],
  // -> MathML carries its meaning in attributes, and none of them are executable
  math: ['xmlns', 'display'],
  annotation: ['encoding'],
  mo: ['stretchy', 'fence', 'separator', 'lspace', 'rspace', 'minsize', 'maxsize'],
  mspace: ['width', 'height', 'depth'],
  mstyle: ['scriptlevel', 'displaystyle', 'mathcolor', 'mathvariant'],
  mpadded: ['width', 'height', 'depth', 'lspace', 'voffset'],
  mtable: ['columnalign', 'rowspacing', 'columnspacing', 'rowlines', 'columnlines'],
  mtd: ['columnalign', 'rowspan', 'columnspan'],
  svg: [...SVG_ATTRIBUTES, 'xmlns', 'xmlns:xlink'],
  circle: SVG_ATTRIBUTES,
  clipPath: SVG_ATTRIBUTES,
  defs: SVG_ATTRIBUTES,
  ellipse: SVG_ATTRIBUTES,
  g: SVG_ATTRIBUTES,
  line: SVG_ATTRIBUTES,
  linearGradient: [...SVG_ATTRIBUTES, 'gradientUnits', 'gradientTransform'],
  marker: [...SVG_ATTRIBUTES, 'markerWidth', 'markerHeight', 'orient', 'refX', 'refY'],
  mask: [...SVG_ATTRIBUTES, 'maskUnits'],
  path: SVG_ATTRIBUTES,
  pattern: [...SVG_ATTRIBUTES, 'patternUnits'],
  polygon: SVG_ATTRIBUTES,
  polyline: SVG_ATTRIBUTES,
  radialGradient: [...SVG_ATTRIBUTES, 'gradientUnits', 'gradientTransform', 'fx', 'fy'],
  rect: SVG_ATTRIBUTES,
  stop: SVG_ATTRIBUTES,
  symbol: SVG_ATTRIBUTES,
  text: [...SVG_ATTRIBUTES, 'dx', 'dy', 'text-anchor', 'font-size', 'font-family'],
  tspan: [...SVG_ATTRIBUTES, 'dx', 'dy'],
  use: SVG_ATTRIBUTES
}

/**
 * Which URL schemes may appear in a link or an embed.
 *
 * `javascript:` is absent, which is the point; `data:` is allowed only for images, where it is how a
 * small inline graphic is written and where it cannot script.
 */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel', 'ftp']

/** Attributes the editor adds for its own preview and that mean nothing in a stored page. */
const EDITOR_ARTIFACT_ATTRIBUTES = ['data-line']

/**
 * Turn a heading into an anchor fragment.
 *
 * Kept deliberately plain — lowercase, words joined by hyphens — because these end up in URLs that
 * people copy and share, and because an existing link should keep working when the heading around it
 * is edited in ways that do not change its words.
 */
export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
      .replaceAll(/\s+/g, '-')
      .replaceAll(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'section'
  )
}

class Rendering {
  /**
   * Clean up a render that came from a client, and pull out what is derived from it.
   *
   * @param html The HTML the editor produced
   * @param permissions What the author may embed. Anything not granted is stripped rather than
   *                    rejected: an author pasting a snippet with a tracking script should get their
   *                    page saved without it, not an error they cannot act on.
   */
  postProcess(html: string, permissions: RenderPermissions): PostProcessResult {
    const clean = this.sanitize(html ?? '', permissions)

    const $ = cheerio.load(clean, null, false)

    this.stripEditorArtifacts($)
    const toc = this.anchorHeadings($)

    return {
      render: $.html(),
      toc,
      text: this.extractText($)
    }
  }

  /**
   * The block elements a page may carry, and what each of them may be given.
   *
   * A block is the one thing in a page that is not HTML, so sanitising against a list of HTML tags
   * drops every one of them and no block ever survives being saved. The list is built from the
   * compiled manifest — a block that is installed may be embedded, one that is not may not — and
   * each tag gets exactly the attributes its component declares as props, which is the same set the
   * editor's block picker offers. The markup is inert either way: what makes a block do anything is
   * the component fetched from `/_blocks` at view time.
   */
  private blockAllowances(): { tags: string[]; attributes: Record<string, string[]> } {
    const tags: string[] = []
    const attributes: Record<string, string[]> = {}
    for (const definition of WIKI.models.blocks.definitions) {
      const tag = `block-${definition.block}`
      tags.push(tag)
      attributes[tag] = (definition.props ?? []).map((prop) => prop.name)
    }
    return { tags, attributes }
  }

  /**
   * Strip everything the author is not allowed to embed.
   */
  private sanitize(html: string, permissions: RenderPermissions): string {
    const blocks = this.blockAllowances()
    const allowedTags = [...BASE_ALLOWED_TAGS, ...blocks.tags]
    const allowedAttributes: Record<string, string[]> = {
      ...BASE_ALLOWED_ATTRIBUTES,
      ...blocks.attributes,
      '*': [...BASE_ALLOWED_ATTRIBUTES['*']]
    }

    if (permissions.styles) {
      allowedTags.push('style')
    }
    if (permissions.scripts) {
      allowedTags.push('script')
      // -> Inline handlers are only meaningful to someone who may also write a script tag
      allowedAttributes['*'].push('on*')
      allowedAttributes.script = ['src', 'type', 'async', 'defer']
      // -> An iframe runs someone else's page inside this one, which is the same trust decision as
      //    running a script, and it is how an author embeds a video or a live example
      allowedTags.push('iframe')
      allowedAttributes.iframe = [
        'src',
        'width',
        'height',
        'allow',
        'allowfullscreen',
        'loading',
        'referrerpolicy',
        'sandbox'
      ]
    }

    return sanitizeHtml(html, {
      allowedTags,
      allowedAttributes,
      // -> `script` and `style` in the allow list are what `write:scripts` and `write:styles` mean:
      //    the library warns about them on every call, and the warning is the thing to silence, not
      //    the permission
      allowVulnerableTags: permissions.scripts || permissions.styles,
      allowedSchemes: ALLOWED_SCHEMES,
      allowedSchemesByTag: {
        img: [...ALLOWED_SCHEMES, 'data']
      },
      // -> A protocol-relative URL inherits the page's scheme, which is fine and common in embeds
      allowProtocolRelative: true,
      // -> Applies only to tags that were dropped: without it, the body of a rejected `<script>`
      //    would come back out as visible page text
      nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
      parser: {
        // -> SVG and MathML have case-sensitive attribute names (`viewBox`, `preserveAspectRatio`),
        //    which lowercasing would quietly break. Tags stay lowercased, so `<SCRIPT>` is still
        //    matched and dropped.
        lowerCaseAttributeNames: false
      }
    })
  }

  /**
   * Drop the markers the editor injects so its preview pane can follow the cursor.
   */
  private stripEditorArtifacts($: cheerio.CheerioAPI): void {
    for (const attribute of EDITOR_ARTIFACT_ATTRIBUTES) {
      $(`[${attribute}]`).removeAttr(attribute)
    }
    // -> The `line` class rides along with `data-line` and is equally meaningless once stored
    $('.line').each((_, el) => {
      const remaining = ($(el).attr('class') ?? '').split(/\s+/).filter((c) => c && c !== 'line')
      if (remaining.length > 0) {
        $(el).attr('class', remaining.join(' '))
      } else {
        $(el).removeAttr('class')
      }
    })
  }

  /**
   * Give every heading an id and build the table of contents out of them.
   *
   * The markdown renderer does not emit heading anchors, so this is where a page becomes deep
   * linkable — and the ids have to exist before the contents tree can point at them.
   */
  private anchorHeadings($: cheerio.CheerioAPI): TocNode[] {
    const used = new Map<string, number>()
    const flat: { level: number; node: TocNode }[] = []

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const heading = $(el)
      const label = heading.text().trim()
      let key = heading.attr('id') || slugifyHeading(label)

      // -> Two headings can legitimately read the same; the second one becomes `-1`, as anchors
      //    generally do, so that both remain addressable
      const seen = used.get(key) ?? 0
      used.set(key, seen + 1)
      if (seen > 0) {
        key = `${key}-${seen}`
      }

      heading.attr('id', key)
      const level = Number.parseInt(el.tagName.slice(1), 10)
      flat.push({
        level,
        node: { key: `#${key}`, label, level, children: [] }
      })
    })

    return this.nestHeadings(flat)
  }

  /**
   * Turn a flat run of headings into the nested tree the sidebar renders.
   *
   * Levels are treated as relative rather than absolute: a page whose headings start at `h2`, or that
   * skips from `h2` to `h4`, still produces a sensible tree instead of an empty top level.
   */
  private nestHeadings(flat: { level: number; node: TocNode }[]): TocNode[] {
    const root: TocNode[] = []
    const stack: { level: number; node: TocNode }[] = []

    for (const entry of flat) {
      while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
        stack.pop()
      }
      if (stack.length > 0) {
        stack[stack.length - 1].node.children.push(entry.node)
      } else {
        root.push(entry.node)
      }
      stack.push(entry)
    }

    return root
  }

  /**
   * The page as plain text, which is what the search index is built from.
   *
   * Works on a copy: scripts and styles read as text but are not prose, and a page carrying them
   * would otherwise turn up in results for whatever its code happens to mention.
   */
  private extractText($: cheerio.CheerioAPI): string {
    const $copy = cheerio.load($.html(), null, false)
    $copy('script, style').remove()
    return $copy.root().text().replaceAll(/\s+/g, ' ').trim()
  }

  /**
   * Whether this instance can render a page at all.
   *
   * Puppeteer is an extension, and one that is not installed by default: rendering server-side is the
   * only thing that needs it, and everything else keeps working without it.
   */
  async isAvailable(): Promise<boolean> {
    const definition = WIKI.models.extensions.getDefinition('puppeteer')
    return Boolean(definition) && (await WIKI.models.extensions.isInstalled(definition!))
  }

  /**
   * Refuse the caller when a page like this one cannot be rendered here.
   *
   * Asked before anything is queued or written rather than left to the job: a request that joins a
   * queue nothing will ever drain looks like it worked, and an approval that cannot produce a matching
   * render would leave a page's HTML lying about its content.
   */
  async ensureCanRender(editor: string): Promise<void> {
    if (editor !== 'markdown') {
      throw new CustomError(
        'renderUnsupportedEditor',
        `Server-side rendering is not implemented for the ${editor} editor.`
      )
    }
    if (!(await this.isAvailable())) {
      throw new CustomError(
        'renderPuppeteerMissing',
        'Rendering a page on the server needs the Puppeteer extension, which is not installed.',
        503
      )
    }
  }

  /**
   * Ask for a page to be rendered, and make sure something will come along to do it.
   *
   * The row is the request and there is only ever one per page, so asking repeatedly — a queue of
   * suggestions being approved onto the same page, an impatient author — collapses into one render of
   * whatever the content has become. `createdAt` is left alone on that path, since a repeat request is
   * not a new one and must not overtake pages that have been waiting longer.
   *
   * The drain job is only added when the queue has none pending, and a spare one is harmless anyway:
   * it finds the table empty and returns without so much as launching a browser.
   */
  async queuePage({
    siteId,
    pageId,
    permissions,
    requestedById
  }: {
    siteId: string
    pageId: string
    permissions: RenderPermissions
    requestedById?: string | null
  }): Promise<void> {
    await WIKI.db
      .insert(renderQueueTable)
      .values({
        siteId,
        pageId,
        allowScripts: permissions.scripts,
        allowStyles: permissions.styles,
        requestedById: requestedById ?? null
      })
      .onConflictDoUpdate({
        target: renderQueueTable.pageId,
        set: {
          allowScripts: permissions.scripts,
          allowStyles: permissions.styles,
          requestedById: requestedById ?? null,
          updatedAt: sql`now()`
        }
      })

    const pending = await WIKI.db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(eq(jobsTable.task, DRAIN_TASK))
      .limit(1)
    if (pending.length < 1) {
      // -> No retries: a render nobody can produce is not worth attempting three times, and the row
      //    stays queued for the next drain either way
      await WIKI.scheduler.addJob({ task: DRAIN_TASK, maxRetries: 0 })
    }
  }

  /**
   * Render every queued page, one at a time, through a single browser.
   *
   * This is the whole point of the queue: a browser costs hundreds of megabytes, so there is exactly
   * one, it is opened when the first page is claimed and reused for the rest of the batch, and no two
   * renders overlap. The scheduler cannot promise that on its own — it runs up to
   * `scheduler.workers` jobs at once — so a second call while this is running does not start a second
   * browser. It asks the one already going to look again before it stops, which is what stops a page
   * queued in the moment between the last claim and the end of the drain from waiting for the next
   * request to come along.
   */
  async drainQueue(): Promise<void> {
    if (this.draining) {
      this.drainRequested = true
      return
    }
    this.draining = true
    try {
      do {
        this.drainRequested = false
        await this.renderQueuedPages()
      } while (this.drainRequested)
    } finally {
      this.draining = false
    }
  }

  /** True while `drainQueue` is working, so that a second call joins it instead of duplicating it. */
  private draining = false

  /** Set when a drain is asked for during one, and re-checked before the running drain gives up. */
  private drainRequested = false

  /**
   * The drain itself: claim a page, render it, store it, repeat until the queue is empty.
   *
   * Claiming is a delete, so an instance can never pick up a page another one is already rendering,
   * and a render that fails is a render that was asked for and did not happen — logged, with the page
   * keeping the HTML it had. Re-queueing it here would be a loop, since whatever made it fail is still
   * true.
   *
   * A failure also drops the browser rather than trusting it: the likeliest one is a render that ran
   * out of time, which leaves a page wedged in whatever loop it was in, and the pages behind it in the
   * queue have done nothing to deserve that.
   */
  private async renderQueuedPages(): Promise<void> {
    // -> Asked before anything else so that the common drain — a spare job for a batch already swept —
    //    costs one query and says nothing
    const waiting = await WIKI.db
      .select({ id: renderQueueTable.id })
      .from(renderQueueTable)
      .limit(1)
    if (waiting.length < 1) {
      return
    }
    if (!(await this.isAvailable())) {
      WIKI.logger.warn(
        'Pages are queued for rendering but the Puppeteer extension is not installed. Leaving them queued.'
      )
      return
    }

    let renderer: PageRenderer | null = null
    try {
      while (true) {
        /*
          Deliberately outside the per-page catch below, and ahead of the claim: a browser that will
          not open is not this page's fault and will not be the next one's either. Letting that throw
          ends the drain with the queue untouched, where treating it as a page failure would burn
          through every row in it — and claiming is a delete.
        */
        renderer ??= await this.createRenderer()

        const claimed = await WIKI.db
          .delete(renderQueueTable)
          .where(
            inArray(
              renderQueueTable.id,
              sql`(SELECT id FROM "pageRenderQueue" ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)`
            )
          )
          .returning()
        const entry = claimed[0]
        if (!entry) {
          return
        }

        try {
          const page = await WIKI.models.pages.getPage({
            siteId: entry.siteId,
            id: entry.pageId,
            withContent: true
          })
          if (!page) {
            // -> Deleted while it waited. The cascade takes the row with it, so this is only reachable
            //    for a page that went between the claim and here.
            continue
          }
          if (page.editor !== 'markdown') {
            WIKI.logger.warn(
              `Cannot render page ${page.id}: server-side rendering is not implemented for the ${page.editor} editor.`
            )
            continue
          }
          const html = await renderer.render(
            page.content ?? '',
            WIKI.sites[entry.siteId]?.config?.editors?.[page.editor]?.config ?? {}
          )
          await WIKI.models.pages.storeRender(entry.siteId, page.id, html, {
            scripts: entry.allowScripts,
            styles: entry.allowStyles
          })
          WIKI.logger.debug(`Rendered page ${page.id} (${page.path}) from its source.`)
        } catch (err: any) {
          WIKI.logger.warn(`Failed to render page ${entry.pageId}: ${err.message}`)
          await this.discardRenderer(renderer)
          renderer = null
        }
      }
    } finally {
      await this.discardRenderer(renderer)
    }
  }

  /**
   * Close a renderer, and keep any trouble doing so to itself.
   *
   * Every close happens on a path that is already finished with the browser — most of them right after
   * a render failed, which is exactly when it is likeliest to be gone already. Letting that failure
   * out would replace the real one, or fail a drain that had otherwise finished its work.
   */
  private async discardRenderer(renderer: PageRenderer | null): Promise<void> {
    try {
      await renderer?.close()
    } catch (err: any) {
      WIKI.logger.debug(`Could not close the render browser cleanly: ${err.message}`)
    }
  }

  /**
   * Open a headless browser on the renderer bundle and hand back something that renders through it.
   *
   * The markdown pipeline lives in the frontend and stays there — this drives it rather than
   * reimplementing it, so a page rendered by the server comes out identical to one saved from the
   * editor.
   *
   * One tab is enough for any number of pages: `__wikiRender` builds a fresh renderer per call and
   * returns a string, so nothing carries over between them but the bundle's own warm caches.
   */
  private async createRenderer(): Promise<PageRenderer> {
    // -> Held in a variable because Puppeteer is not a declared dependency: it is an extension the
    //    operator installs, so a literal import would not typecheck
    const specifier = 'puppeteer'
    let puppeteer: any
    try {
      ;({ default: puppeteer } = await import(specifier))
    } catch (err: any) {
      WIKI.models.extensions.noteLoadFailure(specifier)
      throw new CustomError(
        'renderPuppeteerMissing',
        `Could not load the Puppeteer extension: ${err.message}`,
        503
      )
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    })
    try {
      const page = await browser.newPage()
      // -> A shell page whose only job is to load the frontend's renderer bundle. It is served by this
      //    instance, so the bundle it loads is the one this instance's editor uses.
      await page.goto(`http://127.0.0.1:${WIKI.config.port}/_render`, {
        waitUntil: 'networkidle0'
      })
      await page.waitForFunction('window.__wikiRenderReady === true', {
        timeout: RENDER_READY_TIMEOUT
      })

      return {
        async render(content: string, config: Record<string, any>): Promise<string> {
          /*
            `page.evaluate` has no timeout of its own, and what it calls is a synchronous pass over
            content somebody else wrote: an input that sends one of the markdown plugins into
            catastrophic backtracking would otherwise hold the browser open for as long as it runs, and
            every page behind it in the queue with it. Losing the race throws, and the caller closes
            this renderer rather than reusing a tab that is still busy.
          */
          let timer: ReturnType<typeof setTimeout> | undefined
          const expiry = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new CustomError(
                    'renderTimeout',
                    `Rendering did not finish within ${RENDER_TIMEOUT / 1000} seconds.`,
                    504
                  )
                ),
              RENDER_TIMEOUT
            )
          })
          try {
            // -> This callback is serialized and runs in the browser, where `globalThis` is the window
            //    the renderer bundle attached itself to
            const render = page.evaluate(
              (src: string, cfg: Record<string, any>) => (globalThis as any).__wikiRender(src, cfg),
              content,
              config
            )
            return await Promise.race([render, expiry])
          } finally {
            clearTimeout(timer)
          }
        },
        async close(): Promise<void> {
          await browser.close()
        }
      }
    } catch (err: any) {
      // -> The browser is up but unusable, and nothing else holds a reference to it. Whatever went
      //    wrong loading the bundle is the failure worth reporting, not whatever closing says about it.
      try {
        await browser.close()
      } catch {}
      throw err
    }
  }
}

export const rendering = new Rendering()
