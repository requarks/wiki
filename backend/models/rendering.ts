import { createHash } from 'node:crypto'
import * as cheerio from 'cheerio'
import sanitizeHtml from 'sanitize-html'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { flipFromString, rotateFromString } from '@iconify/utils'
import {
  jobs as jobsTable,
  pageRenderQueue as renderQueueTable,
  pages as pagesTable
} from '../db/schema.ts'
import { CustomError } from '../helpers/common.ts'
import { hrefsFrom } from '../helpers/pageLinks.ts'
import { sanitizeRender } from '../helpers/sanitizeRender.ts'
import type { IconifyIcon } from '@iconify/types'
import type { RenderableBlocks } from './blocks.ts'
import type { RenderPermissions, SanitizableBlock } from '../helpers/sanitizeRender.ts'
import type { IconifyIconCustomisations } from '@iconify/utils'

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
 *    survives depends on what the author is allowed to do — embeds and styles are permissions —
 *    and nothing that runs script in the page survives at all. The browser sanitizes its previews by
 *    the same rules: see `helpers/sanitizeRender.ts`.
 *  - **Normalizing.** The editor leaves scaffolding in its output (line markers for preview scroll
 *    sync) that has no business being stored, and headings arrive without the anchors a table of
 *    contents needs.
 *  - **Resolving.** An icon is a reference when it is written and a picture when it is read, and this
 *    is where it stops being the former — drawn into the page once, at save time, rather than fetched
 *    by every reader's browser on every view.
 *  - **Extracting.** The table of contents and the plain text the search index is built from are both
 *    derived from the final HTML, once it is settled.
 *
 * Re-rendering an existing page from its source — which the server needs when the content is there
 * but the render is stale — goes back through the very same frontend pipeline, driven in a headless
 * browser. That is a job rather than part of a request: see `queuePage` and `drainQueue`.
 */

/**
 * The editors whose source the renderer bundle knows how to turn into HTML.
 *
 * Both pipelines live in the frontend and both are reached through the same `__wikiRender`, which
 * picks one by the editor it is handed -- so this list is the server's copy of what that function
 * will accept, and the two have to agree. An editor missing from it is refused before anything is
 * queued rather than after a browser has been started for it.
 */
const RENDERABLE_EDITORS = new Set(['markdown', 'asciidoc', 'visual'])

/**
 * Editors whose pages are markdown under another name, and whose CONFIG therefore lives elsewhere.
 *
 * The visual editor writes markdown — `contentType: markdown` — and previews it through the very
 * same renderer, with `editors.markdown`'s config rather than its own empty one (see
 * `EditorVisual.vue`). A server-side render has to read the same config or it produces a page that
 * differs from what the author was looking at, over settings like `allowHTML` and `linkify`.
 */
const EDITOR_CONFIG_ALIAS: Record<string, string> = { visual: 'markdown' }

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
  /**
   * Every href the page carries, exactly as written and with repeats left in.
   *
   * Raw on purpose: what an href ADDRESSES depends on where the page holding it sits, on the site's
   * locale prefixes and on its page extensions, none of which is rendering's business. See
   * `helpers/pageLinks.ts`, which reads them, and `models/pageLinks.ts`, which stores what it makes
   * of them.
   */
  links: string[]
}

/**
 * A headless browser standing by on the renderer bundle, good for any number of pages.
 *
 * Opening one is the expensive part of rendering, so it is handed out as a handle to be reused and
 * closed by whoever asked for it rather than opened per page.
 */
interface PageRenderer {
  /**
   * A page's source in, the editor's own HTML out — before `postProcess` gets to it.
   *
   * `context` carries what the source cannot say about itself: the page's own path, since a relative
   * image in a page resolves against the folder it sits in as it would in a repository, and the
   * `editor` it was written with, which is what picks the pipeline on the other side. A source is not
   * self-describing — `= Title` is a heading in one syntax and an attribute list in neither — so
   * nothing can be guessed from the text.
   */
  render(
    content: string,
    config: Record<string, any>,
    context: Record<string, any>
  ): Promise<string>
  close(): Promise<void>
}

/** A page the admin area's Rerender All Pages works through, as it lists them. */
export interface RerenderablePage {
  id: string
  siteId: string
  locale: string
  path: string
  title: string
  editor: string
}

/** What a browser needs to render one page the way its editor would have. */
export interface RerenderSource {
  id: string
  siteId: string
  path: string
  editor: string
  content: string
  /** Sent back with the render, so that one made from content that has since changed is refused. */
  contentHash: string
  /** The site's config for that editor — see `editorConfigFor`. */
  config: Record<string, any>
  /** The site's page extensions, which tell the renderer a link to a page from one to a file. */
  pageExtensions: string[]
}

/** Why a render posted back by Rerender All Pages was or was not stored. */
export type RerenderOutcome = 'stored' | 'missing' | 'changed' | 'unsupported'

/** Attributes the editor adds for its own preview and that mean nothing in a stored page. */
const EDITOR_ARTIFACT_ATTRIBUTES = ['data-line', 'data-line-end']

/**
 * An icon dimension as a CSS length, or nothing when it is not one.
 *
 * Iconify reads a bare `32` as pixels and CSS does not, so the unit has to be spelled out. Anything
 * that is not a plain length is refused rather than passed along: this ends up inside a `style`,
 * where a value carrying a `;` would be a second declaration riding in on the first.
 */
function cssLength(value: string): string {
  const match = /^(\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(value.trim())
  return match ? `${match[1]}${match[2] ?? 'px'}` : ''
}

/**
 * Turn a heading into an anchor fragment.
 *
 * Kept deliberately plain — lowercase, words joined by hyphens — because these end up in URLs that
 * people copy and share, and because an existing link should keep working when the heading around it
 * is edited in ways that do not change its words.
 *
 * The browser has a copy, `slugifyHeading` in `frontend/src/helpers/toc.js`, for the ids it has to spell
 * itself -- a wikilink's section, and a live note's headings, which never pass through here. The two
 * have to agree.
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

/**
 * The child block a tab is, named here because `anchorHeadings` has to ask about it by tag.
 *
 * The one block this file knows about by name. Everything else it does to blocks is a question about
 * the manifest — which are installed, which are children — whereas a tab standing in for a heading is
 * a property of that block's own markup.
 */
const TAB_TAG = 'block-tab'

/**
 * The heading level a tab asked to be listed at, or null for one that is not a heading.
 *
 * Strict about the value: `header` reaches this as whatever an author typed, and a level is one digit
 * from 1 to 6. Anything else — a typo, `0`, `7`, `2px` — means an ordinary tab rather than an error,
 * since the page has to render either way and a tab is perfectly usable without being in the contents.
 */
export function tabHeadingLevel(value: string | undefined): number | null {
  return /^[1-6]$/.test((value ?? '').trim()) ? Number.parseInt(value!.trim(), 10) : null
}

class Rendering {
  /**
   * Clean up a render that came from a client, and pull out what is derived from it.
   *
   * @param siteId Whose blocks decide which block elements may stay — see `blockAllowances`
   * @param html The HTML the editor produced
   * @param permissions What the author may embed. Anything not granted is stripped rather than
   *                    rejected: an author pasting a snippet with a tracking script should get their
   *                    page saved without it, not an error they cannot act on.
   */
  async postProcess(
    siteId: string,
    html: string,
    permissions: RenderPermissions
  ): Promise<PostProcessResult> {
    const siteBlocks = await WIKI.models.blocks.getEnabledForRender(siteId)
    const clean = this.sanitize(html ?? '', permissions, siteBlocks)

    const $ = cheerio.load(clean, null, false)

    this.stripEditorArtifacts($)
    this.unwrapOrphanedChildBlocks($)
    this.liftIconChildren($)
    await this.inlineIcons($)
    const toc = this.anchorHeadings($)

    return {
      render: $.html(),
      toc,
      text: this.extractText($),
      // -> Read off the tree that is already loaded rather than by re-parsing the output, which is
      //    what `linksFromRender` has to do for a page nobody is saving
      links: hrefsFrom($)
    }
  }

  /**
   * The block elements a page may carry, and what each of them may be given.
   *
   * A block is the one thing in a page that is not HTML, so sanitising against a list of HTML tags
   * drops every one of them and no block ever survives being saved. The list is built from what is
   * installed — the compiled manifest, plus the definitions of the custom blocks this site has
   * imported, which are on no disk to be read from — and each tag gets exactly the attributes its
   * component declares as props, which is the same set the editor's block picker offers. The markup
   * is inert either way: what makes a block do anything is the component fetched from `/_blocks` at
   * view time.
   *
   * Installed is not sufficient: the block also has to be switched on for this site. Leaving the
   * picker to decide that would only cover the authors who use it — the content is markdown, so
   * `::block-diagram` is a thing anybody can type, and a block an administrator turned off would
   * otherwise render for every reader of that page. Being stripped on the way in is also what makes
   * turning a block off take effect on the pages that already embed it, since each is re-rendered
   * through here.
   *
   * Child blocks are exempt, having no switch of their own: a tab is part of the tabs it sits in,
   * and is gated by `unwrapOrphanedChildBlocks` once the parent's fate is known.
   */
  private blockAllowances(siteBlocks: RenderableBlocks): SanitizableBlock[] {
    return [...WIKI.models.blocks.definitions, ...siteBlocks.custom]
      .filter((definition) => definition.isChild || siteBlocks.enabled.has(definition.block))
      .map((definition) => ({
        block: definition.block,
        attributes: (definition.props ?? []).map((prop) => prop.name),
        urlAttributes: (definition.props ?? []).filter((prop) => prop.url).map((prop) => prop.name)
      }))
  }

  /**
   * Unwrap child blocks that no longer sit inside a block.
   *
   * A child block is allowed through the sanitiser unconditionally, because whether it may stay is
   * not a question about itself: it is part of its parent, and the parent is what an administrator
   * switches on and off. By this point the answer is visible in the document — a parent that was
   * disabled has already been dropped, leaving its children behind as orphans — so a child with no
   * block above it is one whose parent was turned off, or one an author typed on its own.
   *
   * Unwrapped rather than deleted, which is what the sanitiser does to every other tag it refuses:
   * the element goes, the content the author wrote inside it stays.
   */
  private unwrapOrphanedChildBlocks($: cheerio.CheerioAPI): void {
    const definitions = WIKI.models.blocks.definitions
    const childTags = definitions.filter((d) => d.isChild).map((d) => `block-${d.block}`)
    if (childTags.length < 1) {
      return
    }
    /*
      Every non-child block, not merely the enabled ones: a disabled block is not in the document to
      be matched, and naming the full set keeps this a question about nesting rather than a second
      copy of the enabled-block rule that could disagree with the first.
    */
    const parentTags = definitions.filter((d) => !d.isChild).map((d) => `block-${d.block}`)
    $(childTags.join(',')).each((_, el) => {
      if (parentTags.length > 0 && $(el).parents(parentTags.join(',')).length > 0) {
        return
      }
      $(el).replaceWith($(el).contents())
    })
  }

  /**
   * Strip everything the author is not allowed to embed — see `helpers/sanitizeRender.ts`, which the
   * browser sanitizes its previews with as well.
   */
  private sanitize(
    html: string,
    permissions: RenderPermissions,
    siteBlocks: RenderableBlocks
  ): string {
    return sanitizeRender(sanitizeHtml, html, {
      permissions,
      blocks: this.blockAllowances(siteBlocks)
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
   * Move anything nested inside an `<iconify-icon>` back out, after it.
   *
   * `<iconify-icon icon="…" />` is what an author reaches for, and it is not a self-closing tag: the
   * parser hands the element the rest of the paragraph as children, and the element paints a shadow
   * root with no slot in it — so that text is in the document, counted as content, and invisible on
   * the page. Nothing legitimately goes inside an icon, so lifting the children out is the only
   * reading of that markup that keeps what was written.
   *
   * Document order means a nested pair unpicks itself: the outer icon's children include the inner
   * one, which is then reached in its own turn with whatever it swallowed.
   */
  private liftIconChildren($: cheerio.CheerioAPI): void {
    $('iconify-icon').each((_, el) => {
      const icon = $(el)
      const swallowed = icon.contents()
      if (swallowed.length > 0) {
        icon.after(swallowed)
      }
    })
  }

  /**
   * Draw every `<iconify-icon>` into the page as the `<svg>` it stands for.
   *
   * The element is a reference: opening a page that carries one costs a request to `/_icons` per icon
   * set, for every reader, before the icon appears. Resolving it here spends that once, on the person
   * saving the page, and what gets stored is a picture — the page then draws its icons with no second
   * request at all, and goes on drawing them if the set is later deleted or the instance goes offline.
   *
   * An icon that does not resolve is left as the element it was. That is the honest fallback rather
   * than a hole in the page: the set may be one an administrator is about to add, or upstream may be
   * briefly unreachable, and the element still resolves at view time in either case. It also means
   * this is safe to run over a render that has already been through it — there is nothing left to do.
   *
   * The resolve itself is the same call `/_icons` serves readers from, so this inherits its rules
   * whole: a disabled set is not filled from upstream, an unknown name is not asked about twice, and
   * the upstream budget applies. What is stored is therefore never more than a reader could have got.
   */
  private async inlineIcons($: cheerio.CheerioAPI): Promise<void> {
    const elements = $('iconify-icon').toArray()
    if (elements.length < 1) {
      return
    }

    const referenceOf = (element: cheerio.Cheerio<any>) =>
      (element.attr('icon') ?? '').trim().toLowerCase()

    /*
      Gathered per set before anything is resolved, because `resolveIcons` takes a list: a page built
      out of twenty icons of one set is one query and at most one upstream request, not twenty.
    */
    const wanted = new Map<string, Set<string>>()
    for (const el of elements) {
      const parsed = WIKI.models.icons.parseRef(referenceOf($(el)))
      if (parsed) {
        wanted.set(parsed.prefix, (wanted.get(parsed.prefix) ?? new Set()).add(parsed.name))
      }
    }

    const resolved = new Map<string, IconifyIcon>()
    for (const [prefix, names] of wanted) {
      const found = await WIKI.models.icons.resolveIcons(prefix, [...names])
      for (const [name, icon] of Object.entries(found.icons)) {
        resolved.set(`${prefix}:${name}`, icon)
      }
    }

    for (const el of elements) {
      const element = $(el)
      const icon = resolved.get(referenceOf(element))
      if (icon) {
        element.replaceWith(this.iconSvg($, element, icon))
      }
    }
  }

  /**
   * The `<svg>` that stands in for one `<iconify-icon>`, carrying over what the author put on it.
   *
   * `icon`, `width`, `height`, `rotate` and `flip` are spent on the drawing itself — parsed by
   * Iconify's own parsers, so `flip="horizontal"` and `rotate="90deg"` mean here exactly what they
   * mean to the element. Everything else the author wrote is theirs and rides along: a class, a style,
   * an id to link to.
   *
   * `inline` becomes the baseline nudge the element applies through its host style, since a shadow
   * root's `:host` rule is the one thing about it that cannot survive being drawn into the page.
   *
   * The attributes are set through cheerio rather than built into the markup: they are author input,
   * and this is the difference between a value that gets escaped on the way out and one that closes
   * the tag it was written into.
   */
  private iconSvg(
    $: cheerio.CheerioAPI,
    element: cheerio.Cheerio<any>,
    icon: IconifyIcon
  ): cheerio.Cheerio<any> {
    const customisations: IconifyIconCustomisations = {}
    const width = element.attr('width')
    const height = element.attr('height')
    const rotate = element.attr('rotate')
    const flip = element.attr('flip')
    if (width) {
      customisations.width = width
    }
    if (height) {
      customisations.height = height
    }
    if (rotate) {
      customisations.rotate = rotateFromString(rotate)
    }
    if (flip) {
      flipFromString(customisations, flip)
    }

    const svg = $(WIKI.models.icons.renderInlineSvg(icon, customisations))

    const {
      icon: _icon,
      width: _w,
      height: _h,
      rotate: _r,
      flip: _f,
      inline,
      style,
      class: authorClass,
      ...carried
    } = element.attr() ?? {}
    for (const [name, value] of Object.entries(carried)) {
      svg.attr(name, value)
    }
    /*
      `icon` is the hook `_page-contents.scss` styles it by, and it is not decorative: Tailwind's
      Preflight makes every `svg` a block, so an icon left to itself takes a line of its own instead
      of sitting in the sentence it was written in. The element it replaces has no such problem — it
      declares `display: inline-block` on its own `:host` — which is exactly why this only shows up
      once the page is saved, with the editor's preview looking right. The twemoji images the emoji
      shortcodes become are styled there for the same reason.
    */
    svg.attr('class', ['icon', authorClass].filter(Boolean).join(' '))
    /*
      The size goes into the style as well as into the attributes, and only when it was asked for.
      `.page-contents` sizes an icon to 1.4em by default — an icon reads small beside text at the 1em
      Iconify draws at — and a CSS width outranks the `width` attribute, so an author who wrote
      `width="32"` would otherwise be overruled by the default they were overriding.

      Both axes, read back off the drawing rather than from what was asked for: an author who gave
      only `width` had the other worked out for them from the icon's ratio, and pinning theirs alone
      would leave the stylesheet supplying a height that does not go with it.
    */
    const sized: string[] = []
    if (width || height) {
      for (const axis of ['width', 'height'] as const) {
        const length = cssLength(svg.attr(axis) ?? '')
        if (length) {
          sized.push(`${axis}:${length}`)
        }
      }
    }
    // -> Ours first so that an author who set any of these themselves still wins
    const styles = [...sized, inline === undefined ? '' : 'vertical-align:-0.125em', style ?? '']
      .filter(Boolean)
      .join(';')
    if (styles) {
      svg.attr('style', styles)
    }
    // -> An icon is decoration unless the author gave it a name, in which case it is theirs to describe
    if (!('role' in carried) && !('title' in carried) && !('aria-label' in carried)) {
      svg.attr('aria-hidden', 'true')
    }

    return svg
  }

  /**
   * Give every heading an id and build the table of contents out of them.
   *
   * The markdown renderer does not emit heading anchors, so this is where a page becomes deep
   * linkable — and the ids have to exist before the contents tree can point at them.
   *
   * **A tab can be a heading too.** `::block-tab{label="Foo" header="2"}` asks for its label to be
   * listed as an h2 would be, which nothing else can do for it: the label is an attribute rather than
   * text, so there is no heading element in the render to find, and the panel is not showing unless
   * it is the open tab. The anchor therefore goes on the `block-tab` element itself, and the reader
   * who clicks that row is taken there by the same path as a heading inside a closed tab — the app
   * asks whatever is above the target to reveal it, and `block-tabs` answers by opening the panel.
   *
   * They are matched in one pass rather than two, because a heading written inside a panel has to
   * nest under the tab it is in, and that is only true if both arrive in document order.
   */
  private anchorHeadings($: cheerio.CheerioAPI): TocNode[] {
    const used = new Map<string, number>()
    const flat: { level: number; node: TocNode }[] = []

    $(`h1, h2, h3, h4, h5, h6, ${TAB_TAG}[header]`).each((_, el) => {
      const element = $(el)
      const isTab = el.tagName === TAB_TAG
      const level = isTab
        ? tabHeadingLevel(element.attr('header'))
        : Number.parseInt(el.tagName.slice(1), 10)
      const label = (isTab ? element.attr('label') : element.text())?.trim() ?? ''
      /*
        A tab that asked for a level it cannot have, or that has nothing to be called, stays an
        ordinary tab. Both are the author's mistakes rather than the page's, and a page has to render
        either way — an unlabelled tab is drawn as "Tab 2" by the block, which is not a section title.
      */
      if (!level || (isTab && !label)) {
        return
      }
      let key = element.attr('id') || slugifyHeading(label)

      // -> Two headings can legitimately read the same; the second one becomes `-1`, as anchors
      //    generally do, so that both remain addressable
      const seen = used.get(key) ?? 0
      used.set(key, seen + 1)
      if (seen > 0) {
        key = `${key}-${seen}`
      }

      element.attr('id', key)
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
   *
   * An SVG `text` element is given a space after it, because nothing in the markup separates one from
   * the next. `text()` concatenates, the way `textContent` does, and a drawing has no prose to carry
   * the gaps: an Excalidraw export writes every LINE of every label as a `text` of its own, so a
   * two-line note came out of here as one unsearchable run of letters. Only inside an `svg`, and only
   * for that element, so nothing about how a page's own paragraphs are indexed changes.
   */
  private extractText($: cheerio.CheerioAPI): string {
    const $copy = cheerio.load($.html(), null, false)
    $copy('script, style').remove()
    $copy('svg text').after(' ')
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
    if (!RENDERABLE_EDITORS.has(editor)) {
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
   *
   * **A drain runs in slices of the scheduler's task timeout.** Re-rendering a whole wiki can take far
   * longer than that, which is not the drain being stuck, so `signal` is answered by stopping after
   * the page in hand and handing what is still queued to a fresh job — queued once this drain has let
   * go of the flag, or the new one would join it just as it was finishing.
   */
  async drainQueue(signal?: AbortSignal): Promise<void> {
    if (this.draining) {
      this.drainRequested = true
      return
    }
    this.draining = true
    try {
      do {
        this.drainRequested = false
        await this.renderQueuedPages(signal)
      } while (this.drainRequested && !signal?.aborted)
    } finally {
      this.draining = false
    }
    if (signal?.aborted) {
      // -> Whether or not anything is left: a job that finds the queue empty costs one query
      await WIKI.scheduler.addJob({ task: DRAIN_TASK, maxRetries: 0 })
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
   * true. The log is all that reports it, since the job itself completes either way, so a failure is
   * an error and the batch ends with a count of what did not render.
   *
   * A failure also drops the browser rather than trusting it: the likeliest one is a render that ran
   * out of time, which leaves a page wedged in whatever loop it was in, and the pages behind it in the
   * queue have done nothing to deserve that.
   */
  private async renderQueuedPages(signal?: AbortSignal): Promise<void> {
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
    let rendered = 0
    let failed = 0
    try {
      while (!signal?.aborted) {
        /*
          Deliberately outside the per-page catch below, and ahead of the claim: a browser that will
          not open is not this page's fault and will not be the next one's either. Letting that throw
          ends the drain with the queue untouched, where treating it as a page failure would burn
          through every row in it — and claiming is a delete.
        */
        renderer ??= await this.createRenderer()

        // -> `= (subquery)`, never `IN (subquery)`: postgres may plan an IN as a semi join that re-runs
        //    the subquery per outer row, and each re-run skips the rows already deleted and hands back
        //    the next one — so a LIMIT 1 claim empties the whole queue. A scalar subquery is an
        //    InitPlan, evaluated exactly once.
        const claimed = await WIKI.db
          .delete(renderQueueTable)
          .where(
            eq(
              renderQueueTable.id,
              sql`(SELECT id FROM "pageRenderQueue" ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)`
            )
          )
          .returning()
        const entry = claimed[0]
        if (!entry) {
          return
        }

        let label = entry.pageId
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
          label = `${page.id} (${page.path})`
          if (!RENDERABLE_EDITORS.has(page.editor)) {
            WIKI.logger.error(
              `Cannot render page ${label}: server-side rendering is not implemented for the ${page.editor} editor.`
            )
            failed++
            continue
          }
          const html = await renderer.render(
            page.content ?? '',
            this.editorConfigFor(entry.siteId, page.editor),
            {
              pagePath: page.path,
              pageExtensions: WIKI.sites[entry.siteId]?.config?.pageExtensions ?? [],
              editor: page.editor
            }
          )
          await WIKI.models.pages.storeRender(entry.siteId, page.id, html, {
            scripts: entry.allowScripts,
            styles: entry.allowStyles
          })
          WIKI.logger.debug(`Rendered page ${label} from its source.`)
          rendered++
        } catch (err: any) {
          WIKI.logger.error(`Failed to render page ${label}: ${err.message}`)
          failed++
          await this.discardRenderer(renderer)
          renderer = null
        }
      }
    } finally {
      await this.discardRenderer(renderer)
      if (failed > 0) {
        WIKI.logger.error(
          `Render queue: ${failed} of ${rendered + failed} queued pages failed to render and were left as they were. Re-render them once the cause is fixed.`
        )
      } else if (rendered > 0) {
        WIKI.logger.info(`Render queue: rendered ${rendered} pages.`)
      }
    }
  }

  /**
   * The site's config for an editor, which is what a render of one of its pages is made with.
   *
   * Through `EDITOR_CONFIG_ALIAS`, so a visual page is rendered with the markdown settings its editor
   * previews with.
   */
  editorConfigFor(siteId: string, editor: string): Record<string, any> {
    const configKey = EDITOR_CONFIG_ALIAS[editor] ?? editor
    return WIKI.sites[siteId]?.config?.editors?.[configKey]?.config ?? {}
  }

  /**
   * Every page on every site that a browser can render, for the admin area's Rerender All Pages.
   *
   * That utility is the other way to re-render, and the one that needs no Puppeteer: the admin's own
   * browser runs the pipeline the editor runs, a page at a time, and posts each render back through
   * `storeRerender`. So this is only the list to work through — no content, which for a large wiki
   * would be the whole of it in one reply — and `sourcesForRerender` hands the sources out a batch at
   * a time.
   *
   * @returns The pages, and how many were left out for an editor whose pages have no source to render
   */
  async listForRerender(): Promise<{ pages: RerenderablePage[]; skipped: number }> {
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        siteId: pagesTable.siteId,
        locale: pagesTable.locale,
        path: pagesTable.path,
        title: pagesTable.title,
        editor: pagesTable.editor
      })
      .from(pagesTable)
      .orderBy(asc(pagesTable.siteId), asc(pagesTable.locale), asc(pagesTable.path))
    const pages = rows.filter((row) => RENDERABLE_EDITORS.has(row.editor))
    return { pages, skipped: rows.length - pages.length }
  }

  /**
   * The sources of a batch of pages, with what rendering each one needs. A page that has gone, or
   * whose editor cannot be rendered, is simply not in the answer.
   */
  async sourcesForRerender(ids: string[]): Promise<RerenderSource[]> {
    if (ids.length < 1) {
      return []
    }
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        siteId: pagesTable.siteId,
        path: pagesTable.path,
        editor: pagesTable.editor,
        content: pagesTable.content
      })
      .from(pagesTable)
      .where(inArray(pagesTable.id, ids))
    return rows
      .filter((row) => RENDERABLE_EDITORS.has(row.editor))
      .map((row) => ({
        id: row.id,
        siteId: row.siteId,
        path: row.path,
        editor: row.editor,
        content: row.content ?? '',
        contentHash: hashContent(row.content),
        config: this.editorConfigFor(row.siteId, row.editor),
        pageExtensions: WIKI.sites[row.siteId]?.config?.pageExtensions ?? []
      }))
  }

  /**
   * Store a render a browser produced for Rerender All Pages.
   *
   * Refused as `changed` when the page's content is no longer what the browser was handed: somebody
   * saved it in between, and that save stored a render of its own that this one would replace with
   * HTML describing the content before it.
   *
   * What the render may carry is the page's own say, read off the render it has now — see
   * `inheritedPermissions`. Not the permissions of whoever pressed the button, which on this route is
   * always `manage:system`: that would bring back, on every page at once, each `<iframe>` the
   * sanitizer stripped from an author who was not allowed one, and everything an import brought in.
   */
  async storeRerender(id: string, html: string, contentHash: string): Promise<RerenderOutcome> {
    const rows = await WIKI.db
      .select({
        siteId: pagesTable.siteId,
        editor: pagesTable.editor,
        content: pagesTable.content,
        render: pagesTable.render
      })
      .from(pagesTable)
      .where(eq(pagesTable.id, id))
      .limit(1)
    const page = rows[0]
    if (!page) {
      return 'missing'
    }
    if (!RENDERABLE_EDITORS.has(page.editor)) {
      return 'unsupported'
    }
    if (hashContent(page.content) !== contentHash) {
      return 'changed'
    }
    await WIKI.models.pages.storeRender(
      page.siteId,
      id,
      html,
      this.inheritedPermissions(page.render)
    )
    return 'stored'
  }

  /**
   * What a stored render shows its page was allowed to carry, which nothing else records.
   *
   * A save sanitizes against what its author may embed, so whatever the sanitizer only lets through
   * with a permission being IN the render means that permission was held: an `<iframe>` for
   * `scripts`, a `<style>` for `styles`. Absent, it was either refused or never
   * written, and refusing it again is right either way. A blank render — an import, or one whose
   * render failed — therefore grants nothing, which is what an import is rendered with.
   *
   * A `<style>` inside an `<svg>` is not counted: `inlineIcons` runs after the sanitizer, and an
   * animated icon carries one of its own.
   */
  inheritedPermissions(render: string | null): RenderPermissions {
    if (!render) {
      return { scripts: false, styles: false }
    }
    const $ = cheerio.load(render, null, false)
    const scripts = $('iframe').length > 0
    const styles = $('style')
      .toArray()
      .some((el) => $(el).closest('svg').length < 1)
    return { scripts, styles }
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
      // -> The headless shell: all a renderer needs, and the build the Docker image installs
      headless: 'shell',
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    })
    const mismatch = await describeVersionMismatch(browser)
    if (mismatch) {
      WIKI.logger.warn(mismatch)
    }
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
        async render(
          content: string,
          config: Record<string, any>,
          context: Record<string, any>
        ): Promise<string> {
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
              (src: string, cfg: Record<string, any>, ctx: Record<string, any>) =>
                (globalThis as any).__wikiRender(src, cfg, ctx),
              content,
              config,
              context
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
      // -> A protocol mismatch fails as whichever step trips over it first, in words that name
      //    neither version — `Requesting main frame too early!` from the navigation, typically
      if (mismatch) {
        err.message = `${err.message} - ${mismatch}`
      }
      throw err
    }
  }
}

/** How a re-render recognises the content it was made from, without carrying the content back. */
function hashContent(content: string | null): string {
  return createHash('sha256')
    .update(content ?? '')
    .digest('hex')
}

/**
 * Why the browser Puppeteer launched may not be one it can drive, or null when nothing says so.
 *
 * Puppeteer speaks the DevTools protocol of the one Chrome release it was built against, and a browser
 * some way from it fails without saying why. Puppeteer never picks a mismatched browser by itself: the
 * way to get one is `PUPPETEER_EXECUTABLE_PATH` pointing at a system Chromium that has since moved on.
 *
 * Major versions only, since a patch release either side is routine. The expected version is read from
 * Puppeteer's internal revisions module, as its own `browsers install` command reads it, because there
 * is no public API for it — so if that has moved, the check is skipped rather than failing a render.
 */
async function describeVersionMismatch(browser: any): Promise<string | null> {
  try {
    const specifier = 'puppeteer-core/internal/revisions.js'
    const { PUPPETEER_REVISIONS } = await import(specifier)
    const expected: string = PUPPETEER_REVISIONS['chrome-headless-shell']
    // -> `HeadlessChrome/154.0.8037.57`, or `Chrome/…` for a full browser
    const actual: string = (await browser.version()).split('/').pop()
    if (!expected || !actual || expected.split('.')[0] === actual.split('.')[0]) {
      return null
    }
    const source = process.env.PUPPETEER_EXECUTABLE_PATH
      ? ` It was launched from PUPPETEER_EXECUTABLE_PATH (${process.env.PUPPETEER_EXECUTABLE_PATH}): unset that to use the browser Puppeteer installs for itself, or install the Puppeteer release built for this Chrome.`
      : ''
    return `Puppeteer is built for Chrome ${expected}, but the browser it launched is ${actual}, and may not be one it can drive.${source}`
  } catch {
    return null
  }
}

export const rendering = new Rendering()
