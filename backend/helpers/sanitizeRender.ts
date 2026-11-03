import type SanitizeHtml from 'sanitize-html'

/**
 * Sanitizing a page render — the one set of rules, for both ends.
 *
 * The server sanitizes every render it stores (`rendering.postProcess`), and the browser sanitizes
 * every render it puts on screen: an editor's preview and a live note are built in the browser from
 * the SOURCE, which is anybody's input, and the stored page being clean says nothing about them. If
 * the two used different rules, the preview would either show something the page will not, or run
 * something the page never would. So they use this file.
 *
 * Imported by the frontend straight out of the backend (see `helpers/sanitizeRender.js` there), which
 * is why it imports nothing at runtime: the library is handed in by the caller, each end passing its
 * own copy of the same pinned `sanitize-html`. A bare import here would be resolved against
 * `backend/node_modules` by the frontend build, which has no business depending on it. Keep it that
 * way — types only, and no `WIKI`.
 */

/** What the author is allowed to put in a page, beyond ordinary content. */
export interface RenderPermissions {
  /**
   * `write:scripts` — may embed an `<iframe>`.
   *
   * Never a `<script>` or an inline handler, which no page body may carry regardless of what its
   * author holds: the permission is for the page's own scripts, set in its properties.
   */
  scripts: boolean
  /** `write:styles` — may embed `<style>`. */
  styles: boolean
}

/** A block element a render may carry, with every attribute its component reads. */
export interface SanitizableBlock {
  /** Element suffix: the tag is `block-{block}`. */
  block: string
  /** Prop names as declared, `internal` ones included — see `BlockProp.internal`. */
  attributes: string[]
  /** Those of them that hold an address, which are scheme-checked — see `BlockProp.url`. */
  urlAttributes: string[]
}

/**
 * Tags and attributes a page may use whoever wrote it.
 *
 * Deliberately broad: this is a wiki, the markdown renderer is configured with `allowHTML` on by
 * default, and authors are expected to reach for raw HTML. The line being drawn is not "what looks
 * like a document" but "what can execute", and nothing that can is on these lists: no `<script>`, no
 * `on*` handler, no `javascript:` URL, regardless of what the author may do. Script on a page belongs
 * in its properties (`scripts.jsLoad` and `scripts.jsUnload`), which is what `write:scripts` grants.
 *
 * sanitize-html's own defaults are added to these by `sanitizeRender`, since this file does not load
 * the library — see there.
 */
const BASE_ALLOWED_TAGS = [
  'abbr',
  'audio',
  'button',
  'del',
  'details',
  'figcaption',
  'figure',
  /*
    The Iconify element, so a page can carry an icon the way the interface does.

    The only custom element allowed here that is not a block, and it is allowed unconditionally
    because there is nothing to gate: it is inert markup like the rest of this list, and what draws
    it is already on every page — `boot/iconify.js` defines the element and points it at this
    instance's `/_icons`, so an icon in content resolves against the wiki's own store and reaches no
    third party. A block is gated because an administrator installs and enables it; nobody installs
    this one.

    Note it is not self-closing, whatever the author writes: the parser gives `<iconify-icon … />`
    the rest of the paragraph as children, and the element's shadow root has no slot to show them
    with. `</iconify-icon>` belongs on the end of every one.
  */
  'iconify-icon',
  'img',
  /*
    The checkbox of a task list, and nothing else worth having.

    `BASE_ALLOWED_ATTRIBUTES` has always named the three attributes one may carry -- `type`, `checked`
    and `disabled` -- but the tag itself was never on this list, so sanitizing dropped every one of
    them and a task list came out as two lines of prose. Both editors draw them: `markdown-it-task-lists`
    writes one, and `convert_checklist` in the AsciiDoc pipeline writes the same element.

    It cannot do anything. An `<input>` submits nothing outside a `<form>`, which is not on this list,
    and the renderer marks every one of these disabled; no `on*` handler survives on it, or on
    anything else.
  */
  'input',
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
  /*
    A bitmap placed inside a drawing. `href` is scheme-checked like every other link here -- it is on
    sanitize-html's `allowedSchemesAppliedToAttributes` list, so `javascript:` never survives -- and
    what remains is a URL that fetches a picture, which `img` beside it has always been allowed to do.
    So this grants nothing `img` did not already.

    `data:` is NOT among the allowed schemes, here or on `img`, so an inline bitmap is dropped rather
    than stored. That is the reason the Excalidraw editor puts a pasted image in the asset store and
    refers to it -- see `pendingAssets` in `EditorExcalidraw.vue`.
  */
  'image',
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

/**
 * Presentation attributes shared across the SVG subset above. None of them can execute.
 *
 * The text and font half of the list is here rather than on `text` alone, where three of them used to
 * be. An Excalidraw export gives every line of every label its own `text` element carrying the family,
 * the size, the anchor, the writing direction and the baseline it was drawn with, and an attribute
 * missing from here is dropped in silence -- which is not a mangled attribute but a mangled picture,
 * in the wrong font, at the wrong size, aligned from the wrong edge. Text is also not the only element
 * that inherits a font: a `g` around a label carries one just as well, which is why these are shared
 * rather than spelled per tag.
 *
 * They are inert in the same way the shape attributes above are: each names a length, a colour, a
 * keyword or a font family, and none of them is a URL or a script.
 */
const SVG_ATTRIBUTES = [
  'clip-path',
  'clip-rule',
  'color',
  'cx',
  'cy',
  'd',
  'direction',
  'dominant-baseline',
  'fill',
  'fill-opacity',
  'fill-rule',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'height',
  'href',
  'letter-spacing',
  'mask',
  'offset',
  'opacity',
  'paint-order',
  'points',
  'preserveAspectRatio',
  'r',
  'rx',
  'ry',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
  'text-decoration',
  'transform',
  'vector-effect',
  'viewBox',
  'width',
  'word-spacing',
  'writing-mode',
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
  // -> Everything the element reads except `mode`, which picks how it paints (mask/background) and
  //    only matters to an author working around a specific icon set's colouring. Size and colour are
  //    inherited from the surrounding text by default, which is what an icon in a sentence wants;
  //    `inline` shifts it onto the text baseline, `width`/`height` override the 1em box.
  'iconify-icon': ['icon', 'inline', 'width', 'height', 'rotate', 'flip'],
  img: ['src', 'srcset', 'alt', 'width', 'height', 'loading', 'decoding'],
  input: ['type', 'checked', 'disabled'],
  ol: ['start', 'reversed', 'type'],
  /*
    Column widths, which the AsciiDoc pipeline emits for every table it draws (`[cols="1,2"]` becomes
    a `<colgroup>` of percentages). Presentational and inert -- a width is a number and a unit, and
    `col` is a void element with nothing in it to carry anything else.
  */
  col: ['width', 'span'],
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
  image: SVG_ATTRIBUTES,
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
  // -> `text-anchor`, `font-size` and `font-family` were spelled here; they are in SVG_ATTRIBUTES now
  text: [...SVG_ATTRIBUTES, 'dx', 'dy'],
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

/**
 * Strip everything a render may not carry.
 *
 * @param sanitizeHtml The library, from the caller's own dependencies — see the top of this file
 * @param html The render, as the editor produced it
 * @param options.permissions What its author may embed. Anything not granted is stripped rather than
 *                            rejected: an author pasting a snippet with a tracking script should get
 *                            their page saved without it, not an error they cannot act on.
 * @param options.blocks The block elements that may stay. Which ones is the caller's question: the
 *                       server allows the blocks switched on for the site, while a preview allows
 *                       every one it knows of, so that a disabled block can be shown as one.
 * @param options.blobImages Let an `<img>` load from a `blob:` URL. The editor's preview only: a pasted
 *                           image is shown from one until the save that uploads it, and a stored page
 *                           never holds one.
 */
export function sanitizeRender(
  sanitizeHtml: typeof SanitizeHtml,
  html: string,
  {
    permissions,
    blocks,
    blobImages = false
  }: { permissions: RenderPermissions; blocks: SanitizableBlock[]; blobImages?: boolean }
): string {
  const allowedTags = [...sanitizeHtml.defaults.allowedTags, ...BASE_ALLOWED_TAGS]
  const allowedAttributes: Record<string, string[]> = { ...BASE_ALLOWED_ATTRIBUTES }
  const urlAttributes = new Set(sanitizeHtml.defaults.allowedSchemesAppliedToAttributes)

  for (const { block, attributes, urlAttributes: blockUrlAttributes } of blocks) {
    const tag = `block-${block}`
    allowedTags.push(tag)
    /*
      Every prop under both spellings, because the two ends of this see different ones.

      A prop is declared in camelCase (`showIcons`), which is what the renderer writes and what the
      sanitiser is therefore asked about on the way in. But `postProcess` re-parses its own output
      with cheerio, and an HTML parser lowercases attribute names -- so what is STORED is
      `showicons`, and a later save that sends that render back up offers the sanitiser a name its
      allow list has never heard of, which is dropped. A page properties change made with no editor
      open sends exactly that, so the props of every block on the page vanished the first time
      anybody retagged it, silently and for good: nothing renders them again until the page is
      saved from an editor, which produces the render from the source afresh.

      Matching both is what makes this pass idempotent. Nothing is lost by it either, since HTML
      attribute names are case-insensitive and Lit observes the lowercased form regardless.

      An `on*` name is never one of them, whatever a block declares: a block is gated by an
      administrator, but its attributes are written by whoever wrote the page.
    */
    allowedAttributes[tag] = [
      ...new Set(attributes.flatMap((name) => [name, name.toLowerCase()]))
    ].filter((name) => !/^on/i.test(name))
    /*
      An address a block loads into a frame, or puts in a link, is a `javascript:` URL away from
      script -- draw.io's `server` became an iframe's `src`. So it gets the check `href` and `src` get.
      By name, because that is the only way the library applies one: harmless on any other element,
      where an attribute of that name is either not allowed or not an address anyway.
    */
    for (const name of blockUrlAttributes) {
      urlAttributes.add(name)
      urlAttributes.add(name.toLowerCase())
    }
  }

  if (permissions.styles) {
    allowedTags.push('style')
  }
  if (permissions.scripts) {
    // -> An iframe runs someone else's page inside this one, in that page's origin rather than this
    //    one's, and it is how an author embeds a video or a live example. A trust decision, which is
    //    why it takes the permission, but not script in this page.
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
    // -> `style` in the allow list is what `write:styles` means: the library warns about it on every
    //    call, and the warning is the thing to silence, not the permission
    allowVulnerableTags: permissions.styles,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesAppliedToAttributes: [...urlAttributes],
    allowedSchemesByTag: {
      img: [...ALLOWED_SCHEMES, 'data', ...(blobImages ? ['blob'] : [])]
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
