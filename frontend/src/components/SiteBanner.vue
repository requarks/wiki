<template>
  <!--
    Two classes doing two different jobs. `page-contents` is what draws the markdown INSIDE the notice
    -- its paragraphs, lists, links and code -- exactly as the same markdown would read on a page, and
    is also what zeroes the notice's own outer margins (`> :first-child`, `> :last-child`).

    The notice itself is drawn by `site-banner-alert` in the style block below, which is a COPY of the
    caution admonition rather than a use of it: a banner is chrome an administrator raises over a
    whole site, an admonition is something an author wrote in one page, and the two only happen to
    look alike today. Restyle either without touching the other.
  -->
  <div class="page-contents site-banner" v-if="html" v-html="html" />
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import { escape } from 'es-toolkit/string'

import { useSiteStore } from '@/stores/site'

/**
 * The site-wide banner, above the contents of every page.
 *
 * Site configuration rather than content: it is set in the admin area's General section, is the same
 * on every page, and so never goes through the page renderer -- which renders ONE page, on the server,
 * and stores the result. This renders here instead, on every view, which is also what lets a banner
 * raised during an incident appear without every page being re-rendered.
 *
 * Only the inline parts of markdown are worth anything in a notice a few lines long, but the full
 * block grammar comes free with the parser, so the whole of markdown-it is what runs -- with `html`
 * OFF, unlike the page renderer. An administrator writing a banner is not writing a page, and
 * markdown-it's own link validation (`javascript:` and friends) is then the only escape left to
 * worry about, which it handles itself.
 */

// STORES

const siteStore = useSiteStore()

// DATA

/**
 * The parser, built on first use and kept.
 *
 * Imported dynamically so that markdown-it stays out of the bundle a reader downloads for a site with
 * no banner, which is nearly all of them -- and so that it is fetched alongside the banner rather than
 * ahead of the page.
 */
let md = null

/** Which render is the current one, so that a slower earlier import cannot land on top of a later. */
let generation = 0

const html = ref('')

// COMPUTED

const banner = computed(() => siteStore.banner)

// WATCHERS

watch(banner, render, { deep: true, immediate: true })

// METHODS

async function render() {
  const gen = ++generation
  const { isEnabled, title, content } = banner.value
  if (!isEnabled) {
    html.value = ''
    return
  }

  // -> Text, not markdown: a title is one line, and a heading inside a heading is not what an
  //    administrator typing a sentence there means
  const parts = title ? [`<p class="site-banner-title">${escape(title)}</p>`] : []

  if (content) {
    md ??= new (await import('markdown-it')).default({
      html: false,
      linkify: true,
      breaks: true
    })
    parts.push(md.render(content))
  }

  /*
    Built as a string rather than written in the template around a `v-html` element, because the
    title has to be a DIRECT child of the notice: an element in the template could only hold the
    render in a wrapper of its own, and every `>` selector below would then miss.
  */
  if (gen === generation) {
    html.value = parts.length > 0 ? `<div class="site-banner-alert">${parts.join('')}</div>` : ''
  }
}
</script>

<!--
  Not scoped: the notice and its title are written by `v-html`, and scoped styles reach only the
  elements Vue itself renders. Every selector is under `.site-banner`, which is what keeps it to this
  component -- and what carries the specificity, since these rules sit inside `.page-contents` and
  have to out-weigh its own (`.page-contents p` and friends are two components, so one class is not
  enough).
-->
<style lang="scss">
.site-banner {
  /*
    Flush to the top of the column, a hairline of it left showing either side, and the article's own
    distance below.

    All three are measured off the padding `page-container-body` puts around the article -- 1rem, or
    0.5rem on a phone, which is why the breakpoint here is the 600px `Index.vue` switches that padding
    at. The band takes the whole of it back at the top and all but a pixel of it at the sides, so the
    property below is that padding and the margins are what is left of it.
  */
  --site-banner-pad: 1rem;

  margin: calc(-1 * var(--site-banner-pad)) calc(1px - var(--site-banner-pad)) 1.5rem;

  @media (max-width: $breakpoint-xs-max) {
    --site-banner-pad: 0.5rem;
  }

  /*
    Descended from the caution admonition in `css/_page-contents.scss` and now drawn on its own terms:
    a wash, a heavier rule and an icon -- colour alone would leave a reader who cannot separate the
    hues with nothing to go on, and the icon is a masked SVG rather than a glyph because the app ships
    no icon webfont.

    The rule runs along the BOTTOM and the corners are square, which is where it parts company with an
    admonition: this is a band across the top of the page rather than a block within it, so it reads
    as a strip the article begins under -- squared off to the column's own edges, and closed by a line
    that says where the page's own content starts.

    Its colours are declared here as the banner's OWN two properties rather than read from the content
    palette, so that re-tinting the banner is these two lines (plus the two in the dark block) and
    reaches nothing else.
  */
  .site-banner-alert {
    --site-banner-hue: #c02636;
    --site-banner-wash: rgba(192, 38, 54, 0.08);

    position: relative;
    padding: 0.9em 1.1em 0.9em 3.1em;
    border-bottom: 4px solid var(--site-banner-hue);
    background-color: var(--site-banner-wash);

    /* -> Lighter, because the notice sits on a dark page rather than in the flow of one */
    @at-root .body--dark & {
      --site-banner-hue: #ff8b8b;
      --site-banner-wash: rgba(255, 139, 139, 0.12);
    }

    &::before {
      content: '';
      position: absolute;
      /*
        Centred on the CAP BAND of the first line rather than on the line box holding it: a line box
        is ascent plus descent, and a title inks only what is between the cap line and the baseline,
        so an icon centred on the box reads as sitting a pixel high. `0.9em` is the padding above the
        first line, `0.79em` the middle of the cap band within it, and `0.625em` half the icon.
      */
      top: calc(0.9em + 0.79em - 0.625em);
      left: 1.1em;
      width: 1.25em;
      height: 1.25em;
      /*
        The warning triangle, drawn here as a mask rather than referenced as an icon: a name would be
        resolved at runtime through `/_icons`, and a banner raised because something is wrong is the
        last thing that should depend on a fetch.
      */
      background-color: var(--site-banner-hue);
      mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M13 14h-2V9h2m0 9h-2v-2h2M1 21h22L12 2z'/%3E%3C/svg%3E");
      mask-repeat: no-repeat;
      mask-size: contain;
    }

    /* -> The notice ends where its box does; the last block's own margin would show as a gap */
    > :last-child {
      margin-bottom: 0;
    }

    /*
      The banner's heading, in the notice's colour since that is what it names, and close above the
      text it introduces rather than a paragraph's distance from it.
    */
    > .site-banner-title {
      margin-bottom: 0.3em;
      color: var(--site-banner-hue);
      font-weight: 600;
    }
  }
}
</style>
