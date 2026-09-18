/**
 * The AsciiDoc pipeline, beside the markdown one in `markdown.js`.
 *
 * Asciidoctor.js does the parsing; what is here is what makes its output a page of THIS wiki rather
 * than a standalone AsciiDoc document:
 *
 * - **A converter** (`WikiConverter`), which overrides the handful of `convert_*` methods whose
 *   default output something else in the app has to read -- a stylesheet, a helper that hangs a
 *   button on it, the server's sanitizer, the editor's scroll sync. Each one says why it is there.
 * - **An include processor**, which takes `include::` away completely. See `buildRegistry`.
 * - **One substitution over the source**, which neuters `ifeval::`. See `disableIfeval`.
 *
 * Everything NOT in that list is left exactly as Asciidoctor draws it -- the wrappers (`.paragraph`,
 * `.ulist`, `.listingblock`), the tables, the callouts, the block titles -- and is styled by
 * `css/_page-contents-asciidoc.scss` under `.page-contents.is-asciidoc`. Reshaping it into what
 * markdown-it happens to emit would mean overriding nearly every method to gain nothing, and would
 * throw away the constructs AsciiDoc has and markdown has not.
 *
 * Asciidoctor 4 is a native ESM package with no default export, and its `convert` is ASYNC -- so
 * `render` here is too, unlike `MarkdownRenderer`'s. Every caller awaits it.
 */
import { Extensions, Html5Converter, convert as asciidoctorConvert } from '@asciidoctor/core'

import { codeBlock, fileSrc, isExternalHref } from './shared'

import { escape } from 'es-toolkit/string'

/**
 * The five admonition kinds, onto the classes the content stylesheet already draws.
 *
 * AsciiDoc's five and GitHub's five are the same five, so an admonition is the same object on the
 * page whichever syntax it was written in -- one set of hues, one icon set, one set of print and
 * dark-mode rules. The mapping is a copy of the one in `renderers/modules/github-alerts.js` and has
 * to stay one; see `convert_admonition`.
 */
const ADMONITION_CLASSES = {
  note: 'is-info',
  tip: 'is-success',
  important: 'is-important',
  warning: 'is-warning',
  caution: 'is-danger'
}

/**
 * The style that names one of the wiki's blocks: `[block-tabs]` over a delimited block.
 *
 * Matched on shape rather than against a list, because this renderer has no list to check against --
 * the server strips an element that is not an enabled block (`models/rendering.ts`) and the editor's
 * preview marks one the site has switched off. A block added later needs nothing here.
 */
const WIKI_BLOCK_STYLE = /^block-[a-z\d-]+$/

/**
 * Attributes Asciidoctor puts on a block whether or not the author wrote them, and which are
 * therefore not among the block's own props.
 *
 * `style` is where the `[block-tabs]` went; `title`, `id`, `role` and `reftext` are AsciiDoc's own.
 * The numbered keys are the positional attribute list the style was read out of, and are dropped in
 * `blockProps` rather than named here.
 */
const RESERVED_BLOCK_ATTRIBUTES = new Set(['style', 'title', 'id', 'role', 'reftext'])

/**
 * Document attributes this renderer sets and a page may not change.
 *
 * The `@` suffix is Asciidoctor's own notation for "a default the document may override"; its
 * ABSENCE is what locks a value, which is the point of every entry here. An attribute entry is one
 * line of ordinary-looking source (`:source-highlighter: pygments`), so without this a page could
 * quietly re-point the whole conversion -- at another backend, at a highlighter that is not
 * installed, at a stylesheet of its own -- and the result would look like a broken renderer rather
 * than like something the page did.
 *
 * `showtitle` is deliberately absent, which is what SWALLOWS a document title. A page's title is held
 * in a column of its own and drawn by the app as the page's `<h1>`, so content begins at `==` and
 * comes out as `<h2>` -- the same level `##` produces in markdown.
 */
const LOCKED_ATTRIBUTES = {
  backend: 'html5',
  /*
    Highlighting is `codeBlock`'s, which runs hljs against the theme an administrator picked in the
    admin area. Asciidoctor's own highlighters emit a different set of classes, so a block drawn by
    one of them would come out unstyled on every page of this wiki.
  */
  'source-highlighter': null,
  // -> The wiki builds its own contents from the stored HTML (`anchorHeadings`) and draws it in the
  //    sidebar, not in the article
  toc: null,
  /*
    Unset, and it has to be unset rather than empty. `icon:mdi:home[]` parses into an inline image of
    type `icon` whatever this says -- `convert_inline_image` is what draws it, and none of
    Asciidoctor's three icon modes is wanted, since each reaches for something this wiki does not have
    (a Font Awesome stylesheet, or an image file under an `iconsdir`).

    What the attribute still decides is the CALLOUT LIST, which `convert_colist` draws as a table of
    `<img>` elements whenever `icons` is merely DEFINED -- empty counts. Every callout on every page
    came out as a pair of broken images pointing at `./images/icons/callouts/1.png`.
  */
  icons: null,
  // -> `kbd:[]`, `btn:[]` and `menu:[]`, which markdown can only spell as raw HTML
  experimental: '',
  // -> An unresolved attribute reference is left as the author wrote it rather than taking the line
  //    it sits on with it: a vanished line is a page that silently lost a sentence
  'attribute-missing': 'skip',
  // -> It would otherwise be joined onto the front of every image target, and where a picture loads
  //    from is `fileSrc`'s answer
  imagesdir: ''
}

/**
 * Attributes a page MAY set, with what it gets when it does not.
 *
 * Trailing `@`, so a document that sets one wins. These only change how a page reads.
 */
const DEFAULT_ATTRIBUTES = {
  // -> Off, as markdown has no section numbering either
  sectnums: null,
  idprefix: '@',
  idseparator: '-@',
  tabsize: '2@'
}

/** The whole of an `ifeval::[…]` line, which is a directive only at the very start of one. */
const IFEVAL_DIRECTIVE = /^ifeval::\[.*\][ \t]*$/gm

/**
 * A conditional that is never taken, standing in for one this wiki does not run.
 *
 * `ifndef` on an attribute nothing defines is always TRUE, so what the author wrote between the
 * directive and its `endif::[]` is kept. That is the failure worth having: an `ifeval` was a choice
 * between alternatives, and showing all of them is a page somebody can fix, where hiding them is a
 * page that silently lost a paragraph.
 */
const IFEVAL_REPLACEMENT = 'ifndef::__wikijs_ifeval__[]'

/**
 * Take `ifeval::` out of the source, leaving its `endif::[]` something to close.
 *
 * Done over the text rather than in a preprocessor extension because that is where Asciidoctor
 * itself handles the directive: a preprocessor conditional is resolved before anything is parsed,
 * inside a listing block as much as in a paragraph, so a substitution over the lines sees exactly
 * what the reader would have seen. Deleting the line instead would orphan the `endif::[]` and put an
 * error in the preview.
 *
 * Note this is not a security boundary and is not claimed as one: Asciidoctor.js 4 resolves an
 * `ifeval` expression by parsing two literals and applying one of six comparison operators (see
 * `#evalOp` in its reader), so there is no evaluation of anything to get out of. It is off because a
 * page's own text deciding which of its parts exist is not something a wiki wants to reason about,
 * and because with `LOCKED_ATTRIBUTES` in place there is almost nothing left for one to compare.
 */
function disableIfeval(src) {
  return src.replace(IFEVAL_DIRECTIVE, IFEVAL_REPLACEMENT)
}

/**
 * The extension registry.
 *
 * Built per renderer rather than once for the module: a registry holds the document it was last
 * activated against, and the editor's preview renders on every keystroke while a page view may be
 * rendering something else at the same moment.
 */
function buildRegistry() {
  return Extensions.create('wikijs', function () {
    /*
      `include::` -- off, completely.

      `safe: 'secure'` already refuses to READ the file, but what it renders instead is a link to the
      path, which is meaningless on a page and puts an arbitrary local path in front of a reader.
      Handling every include and pushing back a comment is what makes the directive disappear
      instead.

      There is nothing for one to include in any case. A wiki page is a row in a database with no
      directory beside it, and the render happens in the AUTHOR'S BROWSER -- so the only thing a
      target could ever reach is whatever this wiki serves at that URL, fetched with that author's
      own session.
    */
    this.includeProcessor(function () {
      this.handles(() => true)
      this.process(function (_doc, reader, target) {
        reader.pushInclude(
          `// include::${target}[] is not available in this wiki`,
          target,
          target,
          1,
          {}
        )
      })
    })
  })
}

/**
 * A wiki block's own attributes, as the props to write onto its element.
 *
 * Asciidoctor hands back positional attributes under numeric keys and named ones under their names,
 * plus a few of its own. A wiki block takes everything by name -- the one positional attribute is
 * the style that named the block -- so the numbered keys are dropped along with the reserved ones.
 */
function blockProps(node) {
  return Object.entries(node.getAttributes()).filter(
    ([name]) => !RESERVED_BLOCK_ATTRIBUTES.has(name) && !/^\d+$/.test(name)
  )
}

/**
 * How this wiki draws an AsciiDoc document.
 *
 * Every method here exists because something outside the renderer reads what it produces. A default
 * that is merely shaped differently from markdown-it's is left alone.
 */
class WikiConverter extends Html5Converter {
  /**
   * @param {string} backend The backend Asciidoctor instantiated this for.
   * @param {object} opts Asciidoctor's own converter options.
   * @param {object} context What the source cannot say about itself -- `pagePath`, which a relative
   *                         image resolves against.
   */
  constructor(backend, opts = {}, context = {}) {
    super(backend, opts)
    this.wikiContext = context
  }

  /**
   * The source line a node came from, as the attribute the editor's preview scrolls by.
   *
   * `sourcemap: true` is what puts a line number on a block; without it every node answers null and
   * this contributes nothing, which is right for a render with no editor behind it.
   *
   * `data-line` only, without the `line` class the markdown renderer joins alongside it: the class is
   * stripped again before a page is stored (`postProcess`), and the markup here always already
   * carries a class of Asciidoctor's own -- two `class` attributes on one tag is not markup.
   */
  lineAttr(node) {
    const line = node.getLineNumber?.()
    return line ? ` data-line="${line}"` : ''
  }

  /**
   * One of the wiki's blocks, as the custom element that draws it.
   *
   * The counterpart of what MDC does for markdown: `[block-tabs]` in, `<block-tabs>` out, with the
   * body parsed as ordinary AsciiDoc so a tab holds headings, lists, code and further blocks.
   *
   * Done in the converter rather than through a BlockProcessor extension, and that is the whole
   * reason it works for every block: a processor is registered against ONE style name, so serving
   * every block there is would mean knowing the list -- which the editor does and a headless render
   * does not. A delimited block already parses correctly without one; all that is missing is what it
   * converts to.
   *
   * Props go on as attributes with their values escaped. Note the markdown editor's own writer
   * cannot do this and turns a double quote into a single one instead, because MDC has no escape for
   * one; AsciiDoc does, so a value survives here that would not survive there.
   */
  async wikiBlock(node) {
    const tag = node.getStyle()
    const attrs = blockProps(node)
      .map(([name, value]) => ` ${name}="${escape(String(value))}"`)
      .join('')
    return `<${tag}${attrs}${this.lineAttr(node)}>\n${await node.content()}\n</${tag}>`
  }

  /**
   * The four delimited blocks that can hold other blocks, each checked for a wiki block's style.
   *
   * All four, because this is how AsciiDoc nests: not by growing the fence the way MDC does, but by
   * ALTERNATING the delimiter. A tabset is `====` (example) with each of its tabs a `--` (open)
   * inside it, and a third level would reach for `****` (sidebar).
   */
  async convert_example(node) {
    return this.isWikiBlock(node) ? this.wikiBlock(node) : super.convert_example(node)
  }

  async convert_open(node) {
    return this.isWikiBlock(node) ? this.wikiBlock(node) : super.convert_open(node)
  }

  async convert_sidebar(node) {
    return this.isWikiBlock(node) ? this.wikiBlock(node) : super.convert_sidebar(node)
  }

  async convert_quote(node) {
    return this.isWikiBlock(node) ? this.wikiBlock(node) : super.convert_quote(node)
  }

  isWikiBlock(node) {
    return WIKI_BLOCK_STYLE.test(node.getStyle() ?? '')
  }

  /**
   * An admonition, as the blockquote the content stylesheet draws.
   *
   * Asciidoctor's own markup is a two-cell `<table>` whose first cell holds the label -- a layout
   * from before CSS could do it, and nothing like what this wiki draws. The five kinds map exactly
   * onto the five classes a `> [!NOTE]` produces in markdown, so the two syntaxes reach the same
   * object on the page.
   *
   * A block title becomes the `.alert-title` line, exactly as the words after a `[!NOTE]` marker do;
   * with none, the kind's own label stands in. Both are English, because what is written here is
   * stored as the page's HTML and no reader's locale can reach it afterwards.
   */
  async convert_admonition(node) {
    const name = node.getAttribute('name')
    const className = ADMONITION_CLASSES[name]
    if (!className) {
      return super.convert_admonition(node)
    }
    const idAttr = node.id ? ` id="${node.id}"` : ''
    const label = node.hasTitle() ? node.title : node.getAttribute('textlabel')
    return `<blockquote${idAttr} class="${className}"${this.lineAttr(node)}>
<p class="alert-title">${label}</p>
${await node.content()}
</blockquote>`
  }

  /**
   * A checklist, as the checkboxes the content stylesheet draws.
   *
   * Asciidoctor writes the two states as the characters `&#10003;` and `&#10063;`, which come out as
   * whatever glyph the reader's font happens to have and are indistinguishable to a screen reader
   * from any other tick. `markdown-it-task-lists` writes a disabled `<input type="checkbox">` inside
   * an `li.task-list-item`, which is what `_page-contents.scss` styles and what the sanitizer allows.
   *
   * The label follows the input as a bare text node and is NOT wrapped in anything. That plugin
   * leaves the raw `[x]` marker behind the box in a `<span>`, and the content stylesheet hides
   * `.task-list-item-checkbox + span` to be rid of it -- so a label put in a span here is a label
   * nobody can read, which is exactly what the first draft of this did.
   *
   * Reached from `convert_ulist`, which is where a list decides which of the two it is.
   */
  async convert_checklist(node) {
    const idAttr = node.id ? ` id="${node.id}"` : ''
    const classes = ['contains-task-list', node.role].filter(Boolean).join(' ')
    const title = node.hasTitle() ? `<div class="title">${node.title}</div>\n` : ''
    const items = []
    for (const item of node.getItems()) {
      const checked = item.hasAttribute('checked') ? ' checked' : ''
      const blocks = item.hasBlocks() ? `\n${await item.content()}` : ''
      items.push(
        `<li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled${checked}>${item.getText()}${blocks}</li>`
      )
    }
    return `${title}<ul${idAttr} class="${classes}"${this.lineAttr(node)}>\n${items.join('\n')}\n</ul>`
  }

  /**
   * A bulleted list, as the bare `<ul>` markdown produces.
   *
   * The one place Asciidoctor's wrapper div has to go, and it is not about looks: several rules in
   * `_page-contents.scss` reach a list as a DIRECT CHILD, and a wrapper standing between them matches
   * none of them.
   *
   * - `block-steps > ol` is how a steps block numbers its steps, so a steps block written in AsciiDoc
   *   drew as an ordinary numbered list.
   * - `li > ul` and `dd > ul` are how a nested list is tightened against the item above it.
   * - `ul.links-list` is the row-per-link treatment, which AsciiDoc asks for with `[.links-list]` --
   *   and a role lands on the wrapper, so it never reached the list at all.
   *
   * `display: contents` on the wrapper cannot fix any of that: it takes the box out of the layout but
   * leaves the element in the tree, where a child combinator still trips over it.
   *
   * A list's own title becomes a sibling above it, which is where the wrapper put it anyway.
   */
  async convert_ulist(node) {
    if (node.hasOption('checklist')) {
      return this.convert_checklist(node)
    }
    const classes = [node.style, node.role].filter(Boolean).join(' ')
    return this.listMarkup(node, 'ul', classes ? ` class="${classes}"` : '')
  }

  /**
   * An ordered list, likewise unwrapped.
   *
   * The numbering style rides on the `<ol>` as a class, but ONLY when the author actually asked for
   * one. Asciidoctor gives every ordered list a style whether or not it was written -- `arabic` at the
   * top level, then `loweralpha` and `lowerroman` as they nest -- and those defaults are already what
   * `_page-contents.scss` draws, so writing them out says nothing and costs something:
   * `ol.arabic { list-style-type: decimal }` outranks `block-steps > ol { list-style: none }`, which
   * put a grey marker beside every step of every steps block, next to the numbered disc the block had
   * already drawn for it.
   *
   * The positional attribute is what tells the two apart: it holds the style only when the style was
   * typed (`[loweralpha]`), and is null for one Asciidoctor worked out from the nesting. So an
   * explicit `[arabic]` inside another list still overrides the depth default, which is the whole
   * reason somebody would write it.
   *
   * `type`, `start` and `reversed` are carried over as the attributes they were -- all three are on
   * the sanitizer's list for `ol`.
   */
  async convert_olist(node) {
    const keyword = node.listMarkerKeyword()
    // -> `1` is AsciiDoc's name for the first positional attribute, which is where a written style lands
    const written = node.getAttribute('1') ? node.style : null
    const classes = [written, node.role].filter(Boolean).join(' ')
    const attrs = [
      classes ? ` class="${classes}"` : '',
      keyword ? ` type="${keyword}"` : '',
      node.hasAttribute('start') ? ` start="${escape(node.getAttribute('start'))}"` : '',
      node.hasOption('reversed') ? ' reversed' : ''
    ].join('')
    return this.listMarkup(node, 'ol', attrs)
  }

  /** The body both of them share: an optional title, then the list and its items. */
  async listMarkup(node, tag, attrs) {
    const idAttr = node.id ? ` id="${node.id}"` : ''
    const title = node.hasTitle() ? `<div class="title">${node.title}</div>\n` : ''
    const items = []
    for (const item of node.getItems()) {
      const itemAttrs = item.id
        ? ` id="${item.id}"${item.role ? ` class="${item.role}"` : ''}`
        : item.role
          ? ` class="${item.role}"`
          : ''
      const blocks = item.hasBlocks() ? `\n${await item.content()}` : ''
      items.push(`<li${itemAttrs}><p>${item.getText()}</p>${blocks}</li>`)
    }
    return `${title}<${tag}${idAttr}${attrs}${this.lineAttr(node)}>\n${items.join('\n')}\n</${tag}>`
  }

  /**
   * A code block, drawn by the very function a markdown fence is drawn by.
   *
   * Three things the default cannot give. Asciidoctor does no highlighting at all without a
   * `source-highlighter`, and the ones it ships emit a different set of classes from the `hljs` ones
   * the administrator's chosen theme is injected against. The gutter and the washed rows are this
   * wiki's own markup. And `helpers/renderedContent.js` hangs the copy button on `pre.codeblock`,
   * which nothing else produces.
   *
   * The three extras a markdown fence spells in its info string are block attributes here, and mean
   * the same things:
   *
   *     .Some title here
   *     [source,yaml,start=3,highlight=1..2]
   *
   * `highlight` accepts AsciiDoc's `1..2` and markdown's `1-2` alike -- the dots are rewritten to a
   * hyphen on the way in, since nobody arriving from a markdown page will write two of them.
   */
  async convert_listing(node) {
    /*
      The trailing newline is put back, and it matters. `codeBlock` counts the lines of a block by
      counting its newlines, the way markdown-it hands one over -- a fence's content always ends with
      one. `getSource()` does not, so without this every AsciiDoc block came out a line short: a
      two-line block counted as one, which is the threshold for drawing a gutter at all, so short
      blocks silently lost their line numbers and the last row of a long one was never washed by a
      `highlight` that named it.
    */
    const html = codeBlock(`${node.getSource()}\n`, node.getAttribute('language') ?? '', {
      linesstart: node.getAttribute('start'),
      lineshighlight: (node.getAttribute('highlight') ?? '').replaceAll('..', '-')
    })
    const line = this.lineAttr(node)
    const title = node.hasTitle() ? node.captionedTitle() : ''
    /*
      The bar sits OUTSIDE the scrolling panel, so a titled block is a box holding both -- the same
      shape `markdown.js` builds and for the same reason: a header inside the `<pre>` would slide
      sideways with the code and be indented by the gutter's padding.
    */
    if (title) {
      return `<div class="codeblock-titled hljs"${line}><div class="codeblock-title">${title}</div>${html}</div>`
    }
    // -> Every branch of `codeBlock` opens with `<pre`
    return html.replace(/^<pre/, `<pre${line}`)
  }

  /**
   * A block image, pointed at where the picture actually is.
   *
   * `fileSrc` is the whole reason this is here: an author addresses a picture the way a file sitting
   * beside the page would be addressed, and uploads are served from `/_files/`. Resolving it at
   * render time is what keeps the source readable outside this wiki.
   *
   * Done by rewriting what the superclass produced rather than by rebuilding it, because everything
   * else about an image block -- the link wrapper, the SVG modes, the caption, the float and
   * alignment classes -- is Asciidoctor's and worth keeping.
   */
  async convert_image(node) {
    const html = await super.convert_image(node)
    return this.rewriteImageSources(html).replace(/^<div/, `<div${this.lineAttr(node)}`)
  }

  /**
   * An inline image -- and an icon, which AsciiDoc spells as one.
   *
   * `icon:mdi:home[]` is the AsciiDoc spelling of the markdown renderer's `:mdi:home:` shortcode. The
   * colon inside the target survives the macro's own parsing, so an Iconify reference goes in as
   * itself, and it comes out as the element the rest of the app draws icons with: `models/icons.ts`
   * resolves it, `renderIcons` draws it into the stored page, and the sanitizer allows it
   * unconditionally.
   */
  async convert_inline_image(node) {
    if (node.type !== 'icon') {
      return this.rewriteImageSources(await super.convert_inline_image(node))
    }
    const size = node.hasAttribute('size') ? ` height="${escape(node.getAttribute('size'))}"` : ''
    const title = node.hasAttribute('title') ? ` title="${escape(node.getAttribute('title'))}"` : ''
    return `<iconify-icon icon="${escape(node.target)}"${size}${title}></iconify-icon>`
  }

  /**
   * A link, marked when it leaves the wiki.
   *
   * `is-external-link` is what the content stylesheet draws the outbound arrow from, and it cannot be
   * decided in CSS: a selector can match the shape of an href but not compare its host with this
   * page's own. The class survives being stored -- `postProcess` keeps `class` on every element.
   *
   * Only a `link`. A cross-reference is internal by construction, and a bibliography anchor has no
   * href at all.
   */
  async convert_inline_anchor(node) {
    const html = await super.convert_inline_anchor(node)
    if (node.type !== 'link' || !html || !isExternalHref(node.target)) {
      return html
    }
    return html.includes(' class="')
      ? html.replace(' class="', ' class="is-external-link ')
      : html.replace(/^<a /, '<a class="is-external-link" ')
  }

  /** `data-line`, so the preview can be scrolled to the paragraph the caret is in. */
  async convert_paragraph(node) {
    return (await super.convert_paragraph(node)).replace(/^<div/, `<div${this.lineAttr(node)}`)
  }

  /** The same, for a section -- which is the heading and everything under it. */
  async convert_section(node) {
    return (await super.convert_section(node)).replace(/^<div/, `<div${this.lineAttr(node)}`)
  }

  /**
   * Every `src` in a fragment, resolved the way `fileSrc` resolves one.
   *
   * A pass over rendered text rather than over an attribute, because what the superclass handed back
   * is a string -- the same shape `rewriteHtmlImages` works in on the markdown side, and safe for the
   * same reason: every value written back has been through `URL`.
   */
  rewriteImageSources(html) {
    return html.replace(
      /(\ssrc=")([^"]*)(")/g,
      (_match, before, value, after) =>
        `${before}${fileSrc(value, this.wikiContext.pagePath)}${after}`
    )
  }
}

export class AsciidocRenderer {
  /**
   * @param {object} [config] The site's AsciiDoc editor config. Empty today, and deliberately: every
   *                          switch the markdown renderer offers is either hardwired in AsciiDoc (its
   *                          text replacements, its autolinking) or spelled per block rather than per
   *                          site. Taken all the same, so a setting added later needs no new
   *                          signature.
   */
  constructor(config = {}) {
    this.config = config
    this.registry = buildRegistry()
  }

  /**
   * @param {string} src AsciiDoc source.
   * @param {object} [options]
   * @param {string} [options.pagePath] Path of the page this source belongs to, without a leading
   *                 slash. What a relative image resolves against -- see `fileSrc`.
   * @param {boolean} [options.sourcemap] Whether to stamp `data-line` onto every block, which the
   *                 editor's preview scrolls by and a stored page has no use for. Off by default:
   *                 the attribute is stripped again before a page is stored, so a render with no
   *                 editor behind it would only be paying to produce it.
   * @returns {Promise<string>} The HTML.
   */
  async render(src, { pagePath = '', sourcemap = false } = {}) {
    return asciidoctorConvert(disableIfeval(src ?? ''), {
      standalone: false,
      doctype: 'article',
      /*
        The strictest mode Asciidoctor has, and the one a wiki wants: no reading of files, no
        docinfo, no data-uri of anything local. The include processor above closes the hole it leaves
        -- in secure mode a refused include is rendered as a link to the path rather than dropped.
      */
      safe: 'secure',
      sourcemap,
      extension_registry: this.registry,
      converter_factory: {
        createSync: (backend, opts) => new WikiConverter(backend, opts, { pagePath })
      },
      attributes: { ...DEFAULT_ATTRIBUTES, ...LOCKED_ATTRIBUTES, ...this.config.attributes }
    })
  }
}
