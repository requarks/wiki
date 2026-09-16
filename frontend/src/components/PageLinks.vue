<template>
  <div class="page-links">
    <div class="flex items-center pb-2">
      <w-icon class="mr-2" name="la:link" color="grey" />
      <div class="text-caption text-grey-7">{{ t('common.links.title') }}</div>
      <w-space />
      <!-- -> Up here rather than over the list: the heading already says what is below it, and a
              second line repeating that in order to carry a number is a line spent on the number -->
      <div class="text-caption text-grey-6" v-if="state.loaded && pages.length > 0">
        {{ t('common.links.count', pages.length, { count: pages.length }) }}
      </div>
      <w-spinner class="ml-2" v-if="state.loading" color="primary" size="sm" />
    </div>
    <w-separator />
    <div class="py-6 text-center text-body2 text-grey-6" v-if="state.loading && !state.loaded">
      {{ t('common.links.loading') }}
    </div>
    <template v-else>
      <div class="py-6 text-center" v-if="pages.length < 1">
        <div class="text-body2 text-grey-6">{{ t('common.links.none') }}</div>
        <div class="text-caption text-grey-6 pt-1">{{ t('common.links.noneHint') }}</div>
      </div>
      <div class="page-links-grid" v-else>
        <!--
          Two kinds of link, as the admin dashboard's recent list does it: a page on the site being
          read is a route this app can take itself, and one on another site of this instance is a
          plain href to that site's own host, which the router cannot resolve. `url` is built by the
          server because whether a path carries a locale prefix is a per-site setting.
        -->
        <component
          :is="isCurrentSite(pg) ? 'router-link' : 'a'"
          v-for="pg of pages"
          :key="pg.id"
          class="page-links-card"
          v-bind="isCurrentSite(pg) ? { to: pg.url } : { href: externalPageUrl(pg) }">
          <!-- -> The size is a prop rather than a rule: `WIcon` writes it as an inline style, which
                  beats anything a class here could say -->
          <w-icon class="page-links-card-icon" size="28px" :name="pg.icon || defaultPageIcon" />
          <span class="page-links-card-text">
            <span class="page-links-card-title">{{ pg.title }}</span>
            <span class="page-links-card-desc" v-if="pg.description">{{ pg.description }}</span>
            <!--
              Under the description rather than over it: the path is how the page is addressed and the
              description is what it is about, and what a reader scans a card for is the latter. It
              stays on the card because two pages can wear one title, and on a wiki of any size they
              do.
            -->
            <span class="page-links-card-path">{{ pg.url }}</span>
            <!-- -> Only where it says something the path does not: a page on this site is on the
                    host the reader is already looking at -->
            <span class="page-links-card-host" v-if="!isCurrentSite(pg)">{{ pg.hostname }}</span>
          </span>
          <w-icon class="page-links-card-arrow" size="28px" name="la:arrow-circle-right" />
        </component>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'

import { DEFAULT_PAGE_ICON, usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { apiErrorMessage } from '@/helpers/apiError'

/**
 * The Links tab: every page of this wiki that points at the one being read.
 *
 * Beside the article rather than under it, for the reason the talk page is (`pages/Index.vue`): what
 * links here is a view OF the page, and a list that could run to hundreds of rows is not something to
 * put below the content somebody came to read.
 *
 * **The filtering is the server's, not this component's.** `…/backlinks` drops every page the reader
 * holds no `read:pages` rule for before it answers, because a backlink carries a title and a path —
 * listing one would hand over the existence of a page they cannot open. So there is nothing to hide
 * here, and nothing here may be relied on to hide anything.
 */

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: false,
  loaded: false,
  /** One row per LINK, which is what the endpoint answers with. See `pages` below. */
  links: []
})

const defaultPageIcon = DEFAULT_PAGE_ICON

// COMPUTED

/**
 * The pages, once each and in alphabetical order.
 *
 * The endpoint answers per link rather than per page, since a page may point here more than one way
 * and a future repair has each of those to fix separately — but this is a list of pages, so the
 * first row of each wins and the rest are the same page again.
 *
 * Sorted by what is on screen, which is the title: the server orders by locale and path because that
 * is what its index is in, and neither is what a reader is reading down. `localeCompare` rather than
 * a plain comparison so that an accented or non-Latin title files where the reader expects it.
 */
const pages = computed(() => {
  const seen = new Map()
  for (const link of state.links) {
    if (!seen.has(link.id)) {
      seen.set(link.id, link)
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  )
})

// METHODS

/**
 * Whether a page is on the site being read.
 *
 * Only then can the router take the reader there — a link written on another site of this instance is
 * a different host, and a route this app pushes would resolve against the wrong one.
 */
function isCurrentSite(pg) {
  return !pg.hostname || pg.siteId === siteStore.id
}

/** A page on another site, as an absolute URL on that site's own host. */
function externalPageUrl(pg) {
  return `${window.location.protocol}//${pg.hostname}${pg.url}`
}

async function load() {
  if (!pageStore.id) {
    return
  }
  state.loading = true
  try {
    state.links = await API_CLIENT.get(
      `sites/${siteStore.id}/pages/${pageStore.id}/backlinks`
    ).json()
    state.loaded = true
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.links.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading = false
}

// MOUNTED

onMounted(load)

/*
  The tab is mounted on demand and torn down when the reader leaves it, so this only fires for a page
  that changes underneath an open list -- a move, or a save from another window. Cheap, and a stale
  list of what points at a page that is no longer there is worse than a second request.
*/
watch(
  () => pageStore.id,
  () => load()
)
</script>

<style lang="scss">
/*
  The ink of the list, stated here for the reason `.page-talk` states its own: the article beside it
  takes its colour from `--content-ink` on `.page-contents`, and this column is not page content, so
  without this it inherits whatever the shell leaves on `<body>` -- legible in the light theme and
  dark-on-dark in the other. Same pair as the content sheet, so the two read as one column.
*/
.page-links {
  color: #26292e;

  @at-root .body--dark & {
    color: rgba(255, 255, 255, 0.87);
  }
}

/*
  The cards, laid out to fill whatever width the tab has.

  `auto-fill` with a minimum rather than a column count at breakpoints, which is what `block-index`
  does: that block is drawn inside an article whose width it cannot know, and neither can this -- the
  column here is the window less the navigation sidebar and less the contents panel, either of which
  may or may not be there. A track minimum answers all of those without a media query per combination,
  and gives one column on a phone for the same reason the block falls back to one.

  19rem, because what has to fit across a card is an icon, a title and a path in monospace; below that
  the path wraps on nearly every page and the grid has bought narrower cards at the cost of taller
  ones. It is also what decides when the third column arrives, since the article column is the window
  less the navigation sidebar and the contents panel: a wider minimum here means a common desktop
  never reaches three at all.

  Three per row at the most, which is the `max()`: a track is never allowed to be narrower than a
  third of the row, so `auto-fill` can never make room for a fourth however wide the column gets. The
  ceiling is the same one `block-index` tops out at, and for the same reason -- past three, a title
  and its description have nowhere to go but one word a line. `$gap * 2` is what the two gaps between
  three tracks take out of the width before it is divided.
*/
.page-links-grid {
  $gap: 0.5rem;

  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(max(19rem, calc((100% - #{$gap * 2}) / 3)), 1fr));
  gap: $gap;
  padding: 0.75rem 0;
}

/*
  One card. The shape `block-index` gives a page in a listing, so that a page pointing at this one
  looks the way a page listed in the content does -- a pale panel with a heavy left edge that takes
  the brand colour on hover, and the circled arrow at its right.

  Ported rather than shared: that one is a Lit component styling its own shadow tree off `--q-` custom
  properties, and this is an app component in a stylesheet with `$primary` and the theme classes in
  scope. What is worth keeping identical is what a reader sees.
*/
.page-links-card {
  display: flex;
  position: relative;
  align-items: center;
  gap: 14px;
  padding: 0.75rem 1rem;
  /* -> Room for the arrow, which is positioned against the right edge rather than laid out */
  padding-right: 3.5rem;
  border-radius: 5px;
  /*
    The card's own ink, named so the arrow below can mix against it. `currentColor` would not do the
    job there -- the arrow sets a colour of its own for its resting state, so `currentColor` inside it
    resolves to that grey rather than to the card's.
  */
  --page-links-ink: #{$primary};
  color: var(--page-links-ink);
  text-decoration: none;
  font-weight: 500;
  transition:
    background-color 0.15s var(--ease-standard),
    border-color 0.15s var(--ease-standard);

  @at-root .body--light & {
    background-color: #fafafa;
    background-image: linear-gradient(to bottom, #fff, #fafafa);
    border-right: 1px solid rgba(0, 0, 0, 0.05);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    border-left: 5px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 3px 8px 0 rgba(116, 129, 141, 0.1);

    &:hover {
      background-image: linear-gradient(to bottom, #fff, rgba(255, 255, 255, 0.95));
      border-left-color: $primary;
    }
  }
  @at-root .body--dark & {
    background-color: #222;
    background-image: linear-gradient(to bottom, #161b22, #0d1117);
    border-right: 1px solid rgba(0, 0, 0, 0.5);
    border-bottom: 1px solid rgba(0, 0, 0, 0.5);
    border-left: 5px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 3px 8px 0 rgba(0, 0, 0, 0.25);
    /* -> The app's lightened brand shade, as the block uses on a dark row: primary is picked to read
          on white and is too dim against #161b22 */
    --page-links-ink: var(--color-primary-light);

    &:hover {
      background-image: linear-gradient(to bottom, #1e232a, #161b22);
      border-left-color: $primary;
    }
  }
}

.page-links-card-icon {
  flex: none;
}

.page-links-card-text {
  display: flex;
  flex-direction: column;
  /* -> The row less the icon. `min-width` is what lets a long title wrap inside the card rather than
        pushing the card wider than its track. */
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.page-links-card-title {
  /* -> Two lines at most, then an ellipsis: a card in a grid is one cell of a row, and one page with
        a sentence for a title would otherwise set the height of every card beside it */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.page-links-card-desc,
.page-links-card-path,
.page-links-card-host {
  font-size: 0.8em;
  font-weight: normal;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @at-root .body--dark & {
    color: rgba(255, 255, 255, 0.5);
  }
}

.page-links-card-path {
  font-family: var(--font-mono);
  font-size: 0.75em;
  opacity: 0.85;
}

/*
  The circled arrow, against the card's right edge rather than in the flow: the text column is what
  takes the leftover width, and an arrow laid out after it would be pushed about by however long the
  longest line happens to be.
*/
.page-links-card-arrow {
  position: absolute;
  right: 0.75rem;
  pointer-events: none;
  color: rgba(0, 0, 0, 0.2);
  transition: color 0.15s var(--ease-standard);

  @at-root .body--dark & {
    color: rgba(255, 255, 255, 0.2);
  }

  @at-root .page-links-card:hover & {
    color: color-mix(in srgb, var(--page-links-ink) 50%, transparent);
  }
}
</style>
