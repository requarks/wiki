import * as cheerio from 'cheerio'
import sanitizeHtml from 'sanitize-html'
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
 * browser. See `renderContent`.
 */

/** A heading in the table of contents, shaped for the Quasar tree the page sidebar draws. */
export interface TocNode {
  key: string
  label: string
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
   * Strip everything the author is not allowed to embed.
   */
  private sanitize(html: string, permissions: RenderPermissions): string {
    const allowedTags = [...BASE_ALLOWED_TAGS]
    const allowedAttributes: Record<string, string[]> = {
      ...BASE_ALLOWED_ATTRIBUTES,
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
      flat.push({
        level: Number.parseInt(el.tagName.slice(1), 10),
        node: { key: `#${key}`, label, children: [] }
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
   * Render content to HTML the way the editor would, in a headless browser.
   *
   * The markdown pipeline lives in the frontend and stays there — this drives it rather than
   * reimplementing it, so a page re-rendered by the server comes out identical to one saved from the
   * editor. That costs a browser, which is why it is reserved for an explicit re-render rather than
   * used on every save.
   *
   * Puppeteer is an extension, and one that is not installed by default. When it is missing this says
   * so plainly: re-rendering is the only thing that needs it, and everything else keeps working.
   */
  async renderContent(
    content: string,
    { editor, config }: { editor: string; config: Record<string, any> }
  ): Promise<string> {
    if (editor !== 'markdown') {
      throw new CustomError(
        'renderUnsupportedEditor',
        `Server-side rendering is not implemented for the ${editor} editor.`
      )
    }

    const definition = WIKI.models.extensions.getDefinition('puppeteer')
    if (!definition || !(await WIKI.models.extensions.isInstalled(definition))) {
      throw new CustomError(
        'renderPuppeteerMissing',
        'Re-rendering a page on the server needs the Puppeteer extension, which is not installed.',
        503
      )
    }

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
      await page.waitForFunction('window.__wikiRenderReady === true', { timeout: 30000 })
      // -> This callback is serialized and runs in the browser, where `globalThis` is the window the
      //    renderer bundle attached itself to
      return await page.evaluate(
        (src: string, cfg: Record<string, any>) => (globalThis as any).__wikiRender(src, cfg),
        content,
        config
      )
    } finally {
      await browser.close()
    }
  }
}

export const rendering = new Rendering()
