<template>
  <w-layout>
    <w-header><header-nav /></w-header>
    <w-page-container class="layout-tags">
      <div class="layout-tags-card">
        <w-btn
          class="layout-tags-back"
          icon="la:arrow-circle-left"
          color="white"
          flat
          round
          @click="goBack">
          <w-tooltip anchor="center left" self="center right">{{
            t('common.actions.goback')
          }}</w-tooltip>
        </w-btn>

        <!--
          Below 900px the tag list is a disclosure rather than a column, for the reason the search
          screen's filter panel is: 300px of checkboxes beside a 390px screen leaves the results a
          strip. Open to start with here, though, where the search screen's is closed -- picking a
          tag is the whole of this screen, and with nothing selected there is nothing behind the
          disclosure to look at.
        -->
        <w-btn
          v-if="isTagListCollapsed"
          class="layout-tags-listbtn"
          flat
          no-caps
          :label="t('tags.allTags')"
          :aria-expanded="state.listOpen"
          @click="toggleList">
          <w-icon
            class="layout-tags-listchevron"
            :class="{ 'is-open': state.listOpen }"
            name="mdi:chevron-down" />
        </w-btn>

        <div class="layout-tags-sd" v-show="!isTagListCollapsed || state.listOpen">
          <div class="section-header">{{ t('tags.allTags') }}</div>

          <!--
            How the ticked tags are combined, and beside it the way to untick them all. AND is the
            default because it is what narrowing a list means -- each tag added takes pages away --
            and OR is here because two tags picked off a list are often two interests rather than one
            demand. The pair carries no label: two operators are what they say they are, and the bar
            sits directly under the header naming the list they apply to.

            Clear is an icon here rather than a block of selected-tag chips above the list. Those
            chips grew and shrank as tags were ticked, and every row of them moved the whole list
            under them -- so the tag you had just clicked was no longer under the pointer, and the
            next click landed on a different one. The ticked boxes already say what is selected.

            It comes and goes with the selection, which costs nothing here: it is parked at the far
            end of the row rather than in the flow of the two toggles, so its absence moves neither.
          -->
          <div class="layout-tags-match">
            <w-btn-toggle
              v-model="state.tagsMatch"
              :options="matchOptions"
              :aria-label="t('tags.matchMode')"
              toggle-color="primary"
              color="white"
              text-color="black"
              push
              no-caps
              dense />
            <!--
              How the list below is ordered, which is a different question from how the selection is
              combined -- hence a second group rather than more segments in the first. Alphabetical by
              default: a reader arriving with a tag in mind is looking one up, and only somebody
              browsing wants to know what the wiki is mostly about.
            -->
            <w-btn-toggle
              class="layout-tags-sort"
              v-model="state.tagSort"
              :options="sortOptions"
              :aria-label="t('tags.sortTags')"
              toggle-color="primary"
              color="white"
              text-color="black"
              push
              dense />
            <w-btn
              push
              color="white"
              text-color="black"
              padding="0"
              icon="mdi:clear-circle-multiple-outline"
              v-if="state.selectedTags.length > 0"
              :aria-label="t('tags.clearSelection')"
              @click="clearSelection">
              <w-tooltip>{{ t('tags.clearSelection') }}</w-tooltip>
            </w-btn>
          </div>
          <div
            v-if="siteStore.tagsLoaded && siteStore.tags.length < 1"
            class="p-4 text-caption italic">
            {{ t('tags.noTags') }}
          </div>
          <div class="layout-tags-groups">
            <!--
              One block per initial, which is what makes a list of a few hundred tags scannable: the
              letter is a sticky heading so the one being scrolled past stays named.

              Only alphabetically, though. Ordered by popularity the initials are not contiguous, so
              there is nothing for a letter to head -- that list is one block with no heading at all,
              which is what `group.letter` being null says.
            -->
            <div v-for="group of tagGroups" :key="group.letter ?? ''" class="layout-tags-group">
              <!-- -> The span is the checkbox column; see `&-letter` for why the letter needs one -->
              <div class="layout-tags-letter" v-if="group.letter">
                <span>{{ group.letter }}</span>
              </div>
              <!--
                The count is laid OVER the end of the row rather than beside it, so the checkbox
                below can be the full width of the row and the whole of it is one hit area -- see
                `.layout-tags-tag`. `aria-hidden`, because the box it sits on already announces the
                tag and a bare number read out after it says nothing.
              -->
              <div v-for="tag of group.tags" :key="tag.tag" class="layout-tags-tag">
                <w-checkbox v-model="state.selectedTags" :val="tag.tag" :label="tag.tag" />
                <span class="layout-tags-count" aria-hidden="true">{{ tag.usageCount }}</span>
              </div>
            </div>
          </div>
        </div>

        <w-page>
          <div class="section-header flex items-center">
            <!-- -> What the right-hand half lists is pages, not tags; `tags.title` names the screen -->
            <span>{{ t('common.page.tagsMatching') }}</span>
            <w-space />
            <!--
              A spinner for the whole wait, not just the request: `state.loading` is 0 through the
              debounce, so the count read "No result" from the stale total for 400ms after every tick
              -- the same false answer the pane below was giving, in fewer words. It stands in place
              of the count rather than beside it, so a total about to be replaced is never on screen
              as though it were the answer.

              With nothing ticked there is neither, since no count is being worked out.
            -->
            <template v-if="state.selectedTags.length > 0">
              <w-spinner
                v-if="isBusy"
                size="16px"
                :aria-label="t('tags.retrievingResultsLoading')" />
              <i18n-t
                v-else
                class="text-caption"
                keypath="search.totalResults"
                tag="span"
                :plural="state.total">
                <strong>{{ state.total }}</strong>
              </i18n-t>
            </template>
          </div>

          <div class="layout-tags-toolbar">
            <w-input
              class="layout-tags-within"
              outlined
              dense
              clearable
              hide-bottom-space
              v-model="state.searchWithin"
              :placeholder="t('tags.searchWithinResultsPlaceholder')"
              :aria-label="t('tags.searchWithinResultsPlaceholder')"
              :clear-label="t('common.actions.clear')">
              <template #prepend><w-icon name="la:search" size="xs" /></template>
            </w-input>
            <!--
              Which language to answer in, on a site that has more than one. Results cover every
              locale, so this is what a reader who wants one of them narrows by -- and every locale
              is the default, because a tag is a subject rather than a language. Absent on the
              single-locale wikis that are most of them, where it could only ever say `All locales`.
            -->
            <w-select
              v-if="hasMultipleLocales"
              class="layout-tags-locale"
              outlined
              dense
              options-dense
              hide-bottom-space
              emit-value
              map-options
              v-model="state.filterLocale"
              :options="localeOptions"
              :aria-label="t('tags.locale')">
              <template #prepend><w-icon name="la:language" size="xs" /></template>
            </w-select>
            <div class="layout-tags-orderby">
              <span class="text-caption whitespace-nowrap">{{ t('tags.orderBy') }}</span>
              <w-select
                outlined
                dense
                options-dense
                hide-bottom-space
                emit-value
                map-options
                v-model="state.orderBy"
                :options="orderByOptions"
                :aria-label="t('tags.orderBy')" />
              <!--
                `text-color` goes with `color` on both toggles: WBtnToggle gives an unselected
                segment the page foreground, which in dark mode is white -- and white on a white
                segment is nothing at all. Stated here it is the same pair in both themes, which is
                the point of asking for a white control rather than a themed one.
              -->
              <w-btn-toggle
                v-model="state.orderByDirection"
                :options="orderDirectionOptions"
                :aria-label="t('tags.orderBy')"
                toggle-color="primary"
                color="white"
                text-color="black"
                push
                dense />
            </div>
          </div>

          <!-- -> Nothing has been asked for yet, which is not the same as having found nothing -->
          <div v-if="state.selectedTags.length < 1" class="layout-tags-empty">
            <w-icon name="la:tags" size="48px" />
            <div class="mt-3 text-body1">{{ t('tags.selectOneMoreTags') }}</div>
            <div class="text-caption">{{ t('tags.selectOneMoreTagsHint') }}</div>
          </div>
          <!--
            Ordered ahead of the branch below, which is the whole point: with nothing on screen yet
            there is no veil to draw and the pane fell through to "couldn't find any page", which is
            a claim about an answer that has not come back. `isBusy` and not `state.loading`, so it
            covers the debounce as well -- for 400ms after a tag is ticked no request has started.
          -->
          <div v-else-if="isBusy && state.results.length < 1" class="layout-tags-empty">
            <w-spinner size="42px" class="text-primary" />
            <div class="mt-3 text-caption">{{ t('tags.retrievingResultsLoading') }}</div>
          </div>
          <div v-else-if="state.results.length < 1" class="layout-tags-empty text-caption">
            {{ state.searchWithin ? t('tags.noResultsWithFilter') : t('tags.noResults') }}
          </div>
          <div v-else class="layout-tags-results">
            <router-link
              v-for="item of state.results"
              :key="item.id"
              class="layout-tags-result"
              :to="pageUrl(item)">
              <div class="layout-tags-result-head">
                <w-avatar color="primary" text-color="white" rounded>
                  <w-icon :name="item.icon || defaultPageIcon" size="24px" />
                </w-avatar>
                <div class="min-w-0">
                  <div class="layout-tags-result-title">{{ item.title }}</div>
                  <div class="layout-tags-result-path">{{ pageUrl(item) }}</div>
                </div>
                <!--
                  Which language this hit is in, on a site that has more than one. The results cover
                  every locale, so without it two pages sharing a path read as duplicates -- the URL
                  below carries the prefix, but a card is scanned by its title first. Hidden on the
                  single-locale wikis that are most of them, where every card would carry the same
                  badge and say nothing.
                -->
                <span v-if="hasMultipleLocales" class="layout-tags-result-locale">{{
                  siteStore.localeAlias(item.locale)
                }}</span>
              </div>
              <div class="layout-tags-result-desc" v-if="item.description">
                {{ item.description }}
              </div>
              <div class="layout-tags-result-date">
                {{ t('tags.pageLastUpdated', { date: humanizeDate(item.updatedAt) }) }}
              </div>
            </router-link>
          </div>

          <div class="p-4 text-center" v-if="hasMore">
            <w-btn
              flat
              no-caps
              color="primary"
              :label="t('tags.loadMore')"
              :loading="state.loading > 0"
              @click="loadMore" />
          </div>

          <!--
            The veil is for results that are being REPLACED -- a re-sort, a narrowed search -- where
            dimming what is on screen says the list is about to change. With nothing under it there
            is nothing to dim, and the branch above draws the spinner instead.
          -->
          <w-inner-loading :showing="state.loading > 0 && state.results.length > 0">
            <div class="text-caption">{{ t('tags.retrievingResultsLoading') }}</div>
          </w-inner-loading>
        </w-page>
      </div>
      <w-footer><footer-nav /></w-footer>
    </w-page-container>
    <main-overlay-dialog />
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { useMinWidth } from '@/composables/screen'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'
import { DEFAULT_PAGE_ICON } from '@/stores/page'

import { debounce } from 'es-toolkit/function'
import HeaderNav from '@/components/HeaderNav.vue'
import FooterNav from '@/components/FooterNav.vue'
import MainOverlayDialog from '@/components/MainOverlayDialog.vue'
import { apiErrorMessage } from '@/helpers/apiError'
import { TAG_BROWSER_PARAM, tagBrowserRoute } from '@/helpers/tagBrowser'

/**
 * How many pages one request brings back. The search API caps `limit` at 100; a screenful of cards
 * is far less than that, and the rest are one "Load more" away.
 */
const PAGE_SIZE = 60

/** The bucket a tag that does not start with a letter or a digit is filed under. */
const OTHER_LETTER = '#'
/** And the one for a tag that starts with a digit, so the ten of them do not take ten headings. */
const DIGIT_LETTER = '0-9'

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

/*
  Both halves, as `/_search` needs for the same reason: this route is mounted on its own with no
  layout above it to supply a template, and a title with no template would read without the site name.
  A getter, so the title corrects itself once the locale strings have arrived -- see `composables/meta`.
*/
useMeta(() => {
  const siteTitle = siteStore.title
  return {
    title: t('tags.title'),
    titleTemplate: (title) => `${title} - ${siteTitle}`
  }
})

// DATA

const state = reactive({
  loading: 0,
  /**
   * A load is coming but has not started: the 400ms the debounce below holds a change for.
   *
   * Separate from `loading`, which only counts requests in flight. Between ticking a tag and the
   * request leaving, both the old results and `loading` say nothing is happening -- which is how an
   * empty pane came to announce that there was nothing to find.
   */
  pending: false,
  /** Whether the tag list is open. Only consulted below 900px, where it is a disclosure. */
  listOpen: true,
  selectedTags: [],
  /** How the selection is combined: `all` (AND, the default) or `any` (OR). */
  tagsMatch: 'all',
  /** How the tag LIST is ordered: `alpha` (the default) or `popular`. */
  tagSort: 'alpha',
  searchWithin: '',
  /** The locale to narrow to; empty for every locale, which is what the endpoint reads it as. */
  filterLocale: siteStore.defaultLocaleFilter ?? '',
  orderBy: 'title',
  orderByDirection: 'asc',
  results: [],
  /**
   * How many ROWS have been asked for, which is not `results.length`: the search API drops rows the
   * page rules refuse after it has counted them, so its own offset is the only thing that can be
   * paged with.
   */
  fetched: 0,
  total: 0
})

// COMPUTED

/**
 * Below 900px, where the tag list stops being a column beside the results and becomes a disclosure
 * above them. The same width the search screen's filter panel gives out at, and for the same reason:
 * the two screens are the same shape. The stylesheet has to agree -- `$list-collapse-max`.
 */
const isAtLeast900 = useMinWidth(900)
const isTagListCollapsed = computed(() => !isAtLeast900.value)

/** Whether an answer is on its way, whether or not the request has left yet. */
const isBusy = computed(() => state.loading > 0 || state.pending)

const defaultPageIcon = DEFAULT_PAGE_ICON

/**
 * Whether a result's locale is worth saying. Results span every locale the site has, so the code is
 * what tells two translations of the same page apart -- and on the single-locale wiki that most of
 * them are, it is the same badge on every card.
 */
const hasMultipleLocales = computed(() => siteStore.locales.active.length > 1)

/*
  Every locale, then one entry per locale the site has. The empty string is what "every locale" is on
  the wire as well -- the search endpoint takes `locales` absent to mean all of them -- so nothing has
  to translate a sentinel on the way out.
*/
const localeOptions = computed(() => [
  { label: t('tags.allLocales'), value: '' },
  ...siteStore.locales.active.map((lc) => ({ label: lc.name, value: lc.code }))
])

const orderByOptions = computed(() => [
  { label: t('tags.orderByField.creationDate'), value: 'createdAt' },
  { label: t('tags.orderByField.ID'), value: 'id' },
  { label: t('tags.orderByField.lastModified'), value: 'updatedAt' },
  { label: t('tags.orderByField.path'), value: 'path' },
  { label: t('tags.orderByField.title'), value: 'title' }
])

/*
  `AND` and `OR` are operators, which is exactly as much as two words can say: the tooltip is where
  they say it. The same line serves as the accessible name, since what a screen reader needs here and
  what a pointer needs are the same sentence.
*/
const matchOptions = computed(() => [
  {
    label: t('tags.matchAll'),
    value: 'all',
    ariaLabel: t('tags.matchAllHint'),
    tooltip: t('tags.matchAllHint')
  },
  {
    label: t('tags.matchAny'),
    value: 'any',
    ariaLabel: t('tags.matchAnyHint'),
    tooltip: t('tags.matchAnyHint')
  }
])

const sortOptions = computed(() => [
  {
    value: 'alpha',
    icon: 'mdi:sort-alphabetical-descending-variant',
    ariaLabel: t('tags.sortAlphabetical'),
    tooltip: t('tags.sortAlphabetical')
  },
  {
    value: 'popular',
    icon: 'mdi:sort-numeric-descending-variant',
    ariaLabel: t('tags.sortPopularity'),
    tooltip: t('tags.sortPopularity')
  }
])

const orderDirectionOptions = computed(() => [
  {
    value: 'asc',
    icon: 'mdi:chevron-double-down',
    ariaLabel: t('tags.orderDirectionAscending')
  },
  {
    value: 'desc',
    icon: 'mdi:chevron-double-up',
    ariaLabel: t('tags.orderDirectionDescending')
  }
])

/**
 * The tag list as the sidebar draws it: blocks of `{ letter, tags }`, a heading each where there is
 * one to give.
 *
 * Alphabetically that is one block per initial, which is what makes a list of a few hundred tags
 * scannable. By popularity it is a single block with `letter: null`: the initials are scattered, so
 * there is nothing for a heading to head, and the order itself is the thing being read.
 *
 * `localeCompare` rather than code-unit order throughout, since a tag is a word an author wrote and
 * a plain `sort()` scatters every non-ASCII one. The two catch-all buckets sort last: a wiki's tags
 * are overwhelmingly words, so leading them with `0-9` would put the exceptions in front of the list
 * everyone is actually scanning.
 */
const tagGroups = computed(() => {
  // -> `siteStore.tags` arrives most-used first, which is this order already; the tie-break is ours
  if (state.tagSort === 'popular') {
    const tags = [...siteStore.tags].sort(
      (a, b) => b.usageCount - a.usageCount || a.tag.localeCompare(b.tag)
    )
    return tags.length > 0 ? [{ letter: null, tags }] : []
  }

  const groups = new Map()
  for (const entry of siteStore.tags) {
    const first = entry.tag.charAt(0)
    const letter = /\p{L}/u.test(first)
      ? first.toLocaleUpperCase()
      : /\p{N}/u.test(first)
        ? DIGIT_LETTER
        : OTHER_LETTER
    if (!groups.has(letter)) {
      groups.set(letter, [])
    }
    groups.get(letter).push(entry)
  }
  const rank = (letter) => (letter === DIGIT_LETTER ? 1 : letter === OTHER_LETTER ? 2 : 0)
  return [...groups.entries()]
    .map(([letter, tags]) => ({
      letter,
      tags: [...tags].sort((a, b) => a.tag.localeCompare(b.tag))
    }))
    .sort((a, b) => rank(a.letter) - rank(b.letter) || a.letter.localeCompare(b.letter))
})

/*
  `total` is what the first page reported, so this stays put as later pages come in -- the API
  re-counts per page and subtracts whatever the rules removed from THAT page, which would otherwise
  make the button disappear a page early.
*/
const hasMore = computed(() => state.selectedTags.length > 0 && state.fetched < state.total)

// WATCHERS

/*
  The selection is in the URL, so a set of tags is a link somebody can be handed -- which is the whole
  point of a screen that exists to be arrived at from a tag. This half applies what the URL says; the
  watcher below is the half that writes it, and the two are kept from chasing each other by both
  comparing the joined form before assigning.

  The parameter's name and the route it goes on live in `helpers/tagBrowser`, because they are also
  what everything linking INTO this screen has to know -- the tag chips under a page, today.
*/
watch(
  () => route.query[TAG_BROWSER_PARAM],
  (val) => {
    const next = splitTags(val)
    if (next.join(',') !== state.selectedTags.join(',')) {
      state.selectedTags = next
    }
  },
  { immediate: true }
)

watch(
  () => state.selectedTags,
  (tags) => {
    const val = tags.join(',')
    if (val !== (route.query[TAG_BROWSER_PARAM] ?? '')) {
      router.replace(tagBrowserRoute(tags))
    }
  },
  { deep: true }
)

/*
  Everything the result set depends on, debounced together: the text field is typed into a character
  at a time, and ticking three boxes in a row should be one request rather than three. Registered
  AFTER the query watcher above, so an arriving selection does not also fire this on the way in --
  `onMounted` is what loads the first page.
*/
watch(
  () => [
    state.selectedTags.join(','),
    state.tagsMatch,
    state.searchWithin,
    state.filterLocale,
    state.orderBy,
    state.orderByDirection
  ],
  () => {
    // -> Set here rather than inside the debounced call, which is the point: the wait starts now
    state.pending = true
    requestResults()
  }
)

/*
  The first paint happens before `onMounted` runs, so a page opened straight at `/_tags?t=x` would
  render its pane once with no results and no request yet -- one frame of the very message this flag
  exists to suppress.
*/
state.pending = state.selectedTags.length > 0

// METHODS

/** The debounced loader the watcher above drives. Named, so the watcher can flag the wait first. */
const requestResults = debounce(() => loadResults(true), 400)

function splitTags(val) {
  return (val ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

/**
 * Where a result leads.
 *
 * Per row rather than once for the list, exactly as on the search screen: a tag is carried by pages
 * in every locale, and a bare path addresses the primary one -- which for a hit in another language
 * is the wrong page or no page at all.
 */
function pageUrl(item) {
  return `${siteStore.localeUrlPrefix(item.locale)}/${item.path}`
}

function humanizeDate(val) {
  return userStore.formatDateTime(t, val)
}

function toggleList() {
  state.listOpen = !state.listOpen
}

function clearSelection() {
  state.selectedTags = []
}

function loadMore() {
  loadResults(false)
}

/**
 * Back to wherever the reader came from, and to this locale's home when there is nowhere to go back
 * to -- a tab opened straight at `/_tags`, a link followed from somewhere else.
 *
 * `history.state.back` is the entry vue-router itself records, and is the only thing that answers
 * whether there is one: `history.length` counts the whole tab and is never 0, so the fallback below
 * used to be unreachable and `router.back()` walked the reader out of the wiki instead.
 *
 * The fallback is prefixed, which is the bug this fixes: a bare `/` is the PRIMARY locale's home
 * whatever the reader was reading, so a French reader was sent to the English wiki. This screen's
 * own URL carries no locale, so `readerHomePath` reads it off the reader instead.
 */
function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push(siteStore.readerHomePath)
  }
}

/**
 * Fetch a page of results for the current selection.
 *
 * @param reset Start again from the first row, rather than appending the next page.
 */
async function loadResults(reset) {
  state.pending = false
  if (state.selectedTags.length < 1) {
    state.results = []
    state.fetched = 0
    state.total = 0
    return
  }
  const offset = reset ? 0 : state.fetched
  state.loading++
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/search`, {
      searchParams: {
        tags: state.selectedTags.join(','),
        tagsMatch: state.tagsMatch,
        ...(state.searchWithin ? { query: state.searchWithin } : {}),
        ...(state.filterLocale ? { locales: state.filterLocale } : {}),
        orderBy: state.orderBy,
        orderByDirection: state.orderByDirection,
        offset,
        limit: PAGE_SIZE
      }
    }).json()
    const results = resp?.results ?? []
    state.results = reset ? results : [...state.results, ...results]
    state.fetched = offset + PAGE_SIZE
    if (reset) {
      state.total = resp?.totalHits ?? 0
    }
  } catch (err) {
    if (reset) {
      state.results = []
      state.total = 0
    }
    notify({
      type: 'negative',
      message: t('tags.searchFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.loading--
  }
}

// MOUNTED

onMounted(async () => {
  if (state.selectedTags.length > 0) {
    loadResults(true)
  }
  try {
    await siteStore.fetchTags()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('tags.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
})
</script>

<style lang="scss">
/*
  The same two widths the search screen declares, because this is the same shape of screen -- a sheet
  floating in a tinted page with a 300px sidebar down its left side -- and it runs out of room at the
  same places. `$list-collapse-max` has to agree with the 900px `useMinWidth` above, which is what
  decides whether the disclosure button is rendered at all.
*/
$list-collapse-max: 899.98px;
$card-gutter-max: 1199.98px;

/*
  The two bars on this screen -- the AND/OR bar in the sidebar and the search-and-sort bar over the
  results -- stand at one height, so the eye crossing from one to the other does not step down.

  Derived rather than measured off whichever is taller: the toolbar's height comes from the dense
  fields in it (WInput and WSelect both settle at 2.25rem), while the match bar holds only a dense
  toggle at 2rem and would sit 12px shorter. Both state the padding, and the match bar gives its grid
  row the field's height as a floor -- so the two track each other if the fields are ever resized,
  which a hard-coded 61px could not.
*/
$bar-control-height: 2.25rem;
$bar-padding-y: 0.75rem;

/*
  And the clear button's width, which is the one metric on the band that is simply what it was: the
  box it settled at when its icon was the segments' 14px, kept so that enlarging the icon does not
  widen the button. Named rather than left inline so it reads as a decision instead of a leftover.
*/
$clear-width: 2.375rem;

/*
  And one size for the icons on it, a step up from the 1em the segments' text would give them. Every
  one of them is a control's whole meaning with no label beside it to fall back on, so they are drawn
  at a size a glance can resolve rather than at the size of the word they replace. Applied in CSS to
  all of them at once -- a `size` prop on each would be the same number written several times.
*/
$bar-icon-size: 1.35em;

/*
  The sort pair alone goes a size further, because its glyphs are not one shape each: an A over a Z
  and a 1 over a 9, each beside its own arrow. At the size that suits an arrow or a cross those read
  as a smudge, and which of the two is which is the entire question they are asked.

  1.6em is 22px here, which is as far as it goes without moving anything: a segment is 36px with 6px
  of padding above and below, so an icon past 24px would grow it and take the bar off the toolbar's
  line.
*/
$sort-icon-size: 1.6em;

/*
  And one surface, so that the two read as a single band across the card rather than as two bars that
  happen to be level. The darkest of the three surfaces on this screen in either theme -- under the
  sidebar's list and under the results pane both -- which is what makes the band the top of the card
  rather than part of either column. Named here because two rules far apart in this file set them,
  and a band whose halves drift apart is worse than no band.
*/
$bar-bg-light: $grey-4;
$bar-bg-dark: $dark-6;
$bar-border-light: $grey-5;
$bar-border-dark: $dark-2;

/*
  A lit top edge, which with a darker rule underneath gives a strip a lip to catch the light and makes
  it read as raised rather than as a painted band. Pure white on the light surface; on the dark one
  the same idea at the strength that surface can carry, since a 1px white line over a near-black strip
  is a glare rather than a highlight.

  Named without the bars in it because three rules take it now -- both bars and the letter headings in
  the tag list, which are strips of the same kind and should be lit from the same place.
*/
$lit-edge-light: #fff;
$lit-edge-dark: rgb(255 255 255 / 0.08);

/*
  The grey the results pane is, named because three rules want it: the pane itself, the sticky letter
  headings in the tag list -- which is the same grey by intent rather than by coincidence, so it is
  read from here rather than written out again -- and the top of the light theme's bar gradient.
*/
$pane-bg-light: $grey-2;
$pane-bg-dark: $dark-5;

/*
  Each bar is shaded rather than flat: light at the top, settling onto the bar colour at the bottom,
  so that with the lit edge above it and the darker rule below the band reads as a surface turning
  away from the light rather than as a stripe of a second colour laid over the card.

  The two themes take their top from different places, and deliberately. Light can use the pane's own
  grey, which is 21 steps above the bar colour. Dark cannot: `$dark-5` to `$dark-6` is six steps of a
  0-255 scale and comes out as no gradient at all, so it starts one rung up the ramp instead -- far
  enough to read as shading, which is the whole reason the gradient is there, without the top of the
  band lifting clear of the column it sits in.
*/
$bar-gradient-top-light: $pane-bg-light;
$bar-gradient-top-dark: $dark-4;

$bar-gradient-light: linear-gradient(to bottom, $bar-gradient-top-light, $bar-bg-light);
$bar-gradient-dark: linear-gradient(to bottom, $bar-gradient-top-dark, $bar-bg-dark);

.layout-tags {
  /*
    A dark ground in BOTH themes, a shade apart rather than a theme apart: light mode gets the dark
    theme's value lifted one step ($dark-5 against $dark-6). The card is the light surface on this
    screen, and a light-grey ground under it left the band across the top reading as a foreign strip
    pasted over the page instead of as the top of it.
  */
  @at-root .body--light & {
    background-color: $dark-5;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  /*
    The band the card floats over. Its rule can be one colour for both themes now that what it
    divides is dark on both sides -- the white it used to draw in light mode was a seam between a
    dark band and a light page, and there is no such seam left to draw.
  */
  &:before {
    content: '';
    height: 200px;
    position: fixed;
    top: 0;
    width: 100%;
    background: radial-gradient(ellipse at bottom, $dark-3, $dark-6);
    border-bottom: 1px solid $dark-3;
  }

  &-back {
    position: absolute;
    left: -50px;
  }

  &-card {
    position: relative;
    width: 90%;
    max-width: 1400px;
    margin: 50px auto;
    box-shadow: $shadow-2;
    border-radius: 7px;
    display: flex;
    align-items: stretch;

    /*
      A foreground as well as a background: this card is a plain div rather than a WCard, and a WCard
      is what declares BOTH halves of a surface. Without it everything inside inherits the document's
      black, which is invisible on the dark one.
    */
    @at-root .body--light & {
      background-color: #fff;
      color: var(--color-black);
    }
    @at-root .body--dark & {
      background-color: $dark-3;
      color: var(--color-white);
    }
  }

  &-sd {
    flex: 0 0 300px;
    display: flex;
    flex-direction: column;
    border-radius: 8px 0 0 8px;
    overflow: hidden;

    /*
      One line down the right edge, for the whole height of the column -- the header, the band and the
      list alike -- in the band's own rule colour, and nothing else on that edge from anybody.

      It is stated HERE rather than on each of those in turn because it is one edge: four lines used
      to land on it (this column's border and an inset highlight beside it, the results pane's left
      border, and the AND/OR bar's right border where the band crossed), and across the band they read
      as a smear rather than as a cut edge. Nor can a child paint over them -- `overflow: hidden`
      above, which is what rounds this column's left corners, clips a child at the padding box, so
      nothing inside can reach the border outside it.

      So: this border, and `.w-page`'s light border-left facing it. Two lines, dark then light, which
      is the engraved edge -- the same one all the way down instead of one that changes at the band.
    */
    @at-root .body--light & {
      background-color: $grey-1;
      border-right: 1px solid $bar-border-light;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-right: 1px solid $bar-border-dark;
    }
  }

  /*
    The tag list scrolls on its own rather than growing the card: a wiki can carry several hundred
    tags, and a sidebar as tall as all of them leaves the results beside it starting level with the
    last one. `max-height` rather than a fixed one so a site with a dozen tags gets a short list.
  */
  &-groups {
    flex: 1 1 auto;
    max-height: 60vh;
    overflow-y: auto;
    padding-bottom: 0.5rem;
  }

  /*
    The AND/OR bar, between the list's header and the list itself. Its own tone rather than the
    sidebar's, so it reads as part of the header above it rather than as the first row of the list
    below -- what it does applies to the whole list, not to the tag it happens to sit over.
  */
  /*
    Every control on either bar stands at one height -- the height of the dense fields in the toolbar,
    which is the tallest thing on the band and therefore what sets it.

    A segment is a BLOCK, which is what makes this a `min-height` over a flex box rather than vertical
    padding. Padding was the earlier answer -- it grows the box around the content and so keeps the
    content centred, where a bare minimum on a block would leave it at the top -- but it measures from
    the LINE box, and the line box grows with the icon in it: enlarging these icons took the segments
    to 37px and the toolbar with them, leaving the two bars a pixel out of level. Laid out as a
    centred flex box the height is stated outright and holds whatever the icon does.
  */
  .w-btn-toggle__segment {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: $bar-control-height;
  }

  .w-btn-toggle__segment .w-icon {
    font-size: $bar-icon-size;
  }

  /* -> The sort pair alone, a size up from its neighbours; see `$sort-icon-size` */
  &-sort .w-btn-toggle__segment .w-icon {
    font-size: $sort-icon-size;
  }

  &-match {
    /*
      A row from the left: the two toggles in the order they are read -- how the selection is
      combined, then how the list is ordered -- and the clear button parked at the far end by the
      rule below rather than following them, so its coming and going moves neither.

      A plain flex row now that nothing is centred. The height needs no floor either: both toggles
      are `$bar-control-height` by the segment rule above, which is the same height the toolbar takes
      from its fields, so the two bars come out level without either being told to.
    */
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: $bar-padding-y 1rem;

    /*
      In the toggle's own language: `push` gives WBtn the same 7px corner and the same ledge, and the
      white-on-black pair is what the segments' unselected halves carry.

      Its BOX is stated outright -- the band's shared control height, and the width the button already
      stood at -- rather than left to grow out of an icon plus padding, which is what lets the icon
      inside be sized for legibility without the button growing with it. `padding="0"` on the element
      goes with that: with both dimensions fixed, padding would only squeeze the content box and
      shrink the very icon it is meant to frame. WBtn centres its content, so the icon stays centred
      whatever size it is given.

      `!important` because WBtn writes its geometry as INLINE styles (see its `styles` computed), and
      an inline declaration outranks any stylesheet rule however specific. Only `min-height` collides
      with one; the width it never sets.
    */
    .w-btn {
      /* -> Parked at the far end, out of the toggles' flow; see the note on the bar above */
      margin-left: auto;
      /* stylelint-disable-next-line declaration-no-important */
      min-height: $bar-control-height !important;
      width: $clear-width;
    }

    /*
      Its icon at the band's size too. WBtn draws button icons at 1.715em -- its own rule, written for
      a button whose box grows to fit -- which in a box fixed at the size above is most of the button.
    */
    .w-btn .w-icon {
      font-size: $bar-icon-size;
    }

    /* -> No right edge of its own: the column draws that one, and for its whole height -- see `&-sd` */
    @at-root .body--light & {
      background-color: $bar-bg-light;
      background-image: $bar-gradient-light;
      border-top: 1px solid $lit-edge-light;
      border-bottom: 1px solid $bar-border-light;
    }
    @at-root .body--dark & {
      background-color: $bar-bg-dark;
      background-image: $bar-gradient-dark;
      border-top: 1px solid $lit-edge-dark;
      border-bottom: 1px solid $bar-border-dark;
    }
  }

  /*
    Air above every group but the first, so a letter heading reads as the start of the block under it
    rather than as a row of the block above. On the GROUP rather than as a top margin on the sticky
    heading itself: a margin ABOVE a sticky element is carried with it as it sticks, so the gap would
    travel down the list and sit over the rows the heading passes. A margin BELOW one stays in the
    flow where the group starts and simply scrolls away under it, which is why the rule below can use
    one to hold its first row off.
  */
  &-group + &-group {
    margin-top: 0.75rem;
  }

  &-letter {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 0.25rem 1rem;
    margin-bottom: 0.35rem;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;

    /*
      The letter sits over the column of checkboxes under it rather than at the start of the line: a
      box the width of one checkbox (`size-5`, 1.25rem), centred, and starting where a checkbox does
      -- this heading's left padding is the same 1rem the tag rows give their button. A span, because
      a bare text node cannot be given a width, and a fixed one because the glyphs are not all the
      same width and an `I` and a `W` would otherwise sit in different places.

      No `letter-spacing` either: on a single character it is trailing space, which inside a centred
      box pushes the glyph off centre by half of itself.
    */
    > span {
      display: inline-block;
      width: 1.25rem;
      text-align: center;
    }

    @at-root .body--light & {
      color: $grey-7;
      background-color: $pane-bg-light;
      border-top: 1px solid $lit-edge-light;
      border-bottom: 1px solid $grey-3;
    }
    @at-root .body--dark & {
      color: $grey-5;
      background-color: $pane-bg-dark;
      border-top: 1px solid $lit-edge-dark;
      border-bottom: 1px solid $dark-2;
    }
  }

  /*
    The whole row toggles the box, not just the 20px square and the word beside it -- a list of tags
    is scanned and clicked at speed, and a target that is only as wide as its label is a target you
    have to aim at.

    The row is therefore the button and nothing else: the checkbox stretches across all of it and the
    count is positioned OVER its right end, with `pointer-events: none` so a click there still lands
    on the button underneath. The count cannot simply sit beside the button instead -- as a flex
    sibling it would take the right end of the row out of the hit area, which is what a `WSpace`
    between the two used to do rather more of, splitting the free space evenly between the spacer and
    the button and leaving barely more than the word itself clickable.
  */
  &-tag {
    position: relative;
    display: flex;
    align-items: center;

    /*
      A row that is the FIRST thing in its group is a row with no heading above it, which is the
      popularity ordering -- there the initials are scattered and nothing heads the list, so without
      this the first tag sits flush against the top of the scroll box. Alphabetically no row matches:
      the letter heading is the first child there, and it supplies the space itself.

      Stated as the selector rather than as a modifier class on the group, because it is the same
      fact: the heading is what this replaces, so its absence is the condition.
    */
    &:first-child {
      margin-top: 0.5rem;
    }

    @at-root .body--light & {
      &:hover {
        background-color: $grey-2;
      }
    }
    @at-root .body--dark & {
      &:hover {
        background-color: $dark-3;
      }
    }

    /*
      The row's padding is the BUTTON's padding. Held by the row instead, the gutters are part of the
      row and not of the button inside it, so the 16px at either end -- a sixth of a 300px sidebar --
      looked like part of the target and did nothing when clicked. The right-hand value also leaves
      the lane the count sits in, so a long tag runs out of room before it reaches the number.
    */
    .w-checkbox {
      flex: 1 1 auto;
      min-width: 0;
      text-align: left;
      padding: 0.25rem 2.25rem 0.25rem 1rem;
    }

    /* -> The label, not the box: a tag longer than the row ellipsises instead of widening it */
    .w-checkbox > span:not(.w-checkbox__box) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &-count {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    /* -> A click on the count is a click on the row it labels; see `.layout-tags-tag` */
    pointer-events: none;
    font-size: 0.7rem;
    line-height: 1.2;
    padding: 1px 6px;
    border-radius: 9999px;

    @at-root .body--light & {
      color: $grey-7;
      background-color: $grey-3;
    }
    @at-root .body--dark & {
      color: $grey-4;
      background-color: $dark-2;
    }
  }

  /*
    The bar over the results. Wraps rather than squeezing: the text field and the ordering controls
    are two groups that each have a minimum useful width, and below about 700px of card they stack
    instead of shrinking into each other.
  */
  &-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: $bar-padding-y 1rem;

    /* -> The same surface as the AND/OR bar beside it; see `$bar-bg-light` */
    @at-root .body--light & {
      background-color: $bar-bg-light;
      background-image: $bar-gradient-light;
      border-top: 1px solid $lit-edge-light;
      border-bottom: 1px solid $bar-border-light;
    }
    @at-root .body--dark & {
      background-color: $bar-bg-dark;
      background-image: $bar-gradient-dark;
      border-top: 1px solid $lit-edge-dark;
      border-bottom: 1px solid $bar-border-dark;
    }
  }

  &-within {
    flex: 1 1 240px;
    min-width: 0;
  }

  /* -> A fixed width, like the ordering select beside it: a row of controls that resize as their
        value changes is a row that moves under the pointer */
  &-locale {
    flex: none;
    width: 160px;
  }

  &-orderby {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .w-select {
      width: 160px;
    }
  }

  /*
    Two columns at most, and a fixed count rather than `auto-fill`: a card carries a title, a path and
    three lines of description, and at the card's full width `auto-fill` fitted four of them across a
    wide window -- each too narrow to read and the row of them too far from the eye to scan. `minmax(0,
    1fr)` and not `1fr`, so a long unbroken path cannot push a column past its share of the track.
  */
  &-results {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    padding: 1rem;
  }

  /*
    A card is one link, so the whole of it is the hit area rather than the title alone -- the path and
    the date read as part of the same target instead of as dead text beside it.
  */
  &-result {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 6px;
    color: inherit;
    text-decoration: none;
    transition:
      border-color 0.2s var(--ease-standard),
      box-shadow 0.2s var(--ease-standard);

    /*
      Raised off the pane rather than drawn on it: on grey, a bordered white box reads as a hole and a
      shadowed one as a card. Dark mode keeps a faint edge at rest as well, because a shadow over a
      near-black pane is almost nothing to look at.

      The border is 2px WIDE AT REST, transparent in light and barely there in dark, because the width
      is what must not change: it is reserved space, and growing a 1px border into a 2px one on hover
      would pull every line inside the card in by a pixel. Dark's resting edge carries the same ink
      over those two pixels as it did over one -- half the alpha -- so what changes on hover is the
      colour and nothing else.

      Elevation 1 at rest (`--shadow-card`, the same token a WCard carries) and elevation 2 on hover
      (`$shadow-2`): two steps, so the lift is something that happens rather than something already
      there. They have to be different tokens to say that at all -- `--shadow-menu` and `$shadow-2`
      are the same three shadows written twice, so a card using one for rest and the other for hover
      does not move.
    */
    @at-root .body--light & {
      background-color: #fff;
      border: 2px solid transparent;
      box-shadow: var(--shadow-card);

      &:hover {
        border-color: $primary;
        box-shadow: $shadow-2;
      }
    }
    @at-root .body--dark & {
      background-color: $dark-3;
      border: 2px solid rgb(255 255 255 / 0.04);
      box-shadow: var(--shadow-card);

      &:hover {
        border-color: var(--color-primary-light);
        box-shadow: $shadow-2;
      }
    }

    &-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    /* -> Two lines at most: a card in a grid track cannot grow to fit a long title without leaving a
          ragged row beside it */
    &-title {
      font-weight: 500;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /*
      Top-right of the card rather than centred in the head: the head is a row whose height is the
      avatar's, and a badge centred against it drifts off the corner the eye goes to.
    */
    &-locale {
      flex: none;
      margin-left: auto;
      align-self: flex-start;
      padding: 0.05rem 0.35rem;
      border-radius: 4px;
      font-size: 0.65rem;
      line-height: 1.4;
      letter-spacing: 0.02em;
      text-transform: uppercase;

      @at-root .body--light & {
        color: $grey-7;
        background-color: $grey-3;
      }
      @at-root .body--dark & {
        color: $grey-5;
        background-color: $dark-2;
      }
    }

    &-path {
      font-size: 0.75rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      @at-root .body--light & {
        color: $grey-7;
      }
      @at-root .body--dark & {
        color: $grey-5;
      }
    }

    &-desc {
      flex: 1 1 auto;
      font-size: 0.8rem;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;

      @at-root .body--light & {
        color: $grey-8;
      }
      @at-root .body--dark & {
        color: $grey-4;
      }
    }

    &-date {
      margin-top: auto;
      font-size: 0.7rem;

      @at-root .body--light & {
        color: $grey-6;
      }
      @at-root .body--dark & {
        color: $grey-6;
      }
    }
  }

  &-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    text-align: center;

    @at-root .body--light & {
      color: $grey-6;
    }
    @at-root .body--dark & {
      color: $grey-5;
    }
  }

  /*
    Primary, matching the section headers on the search and profile screens. Not `text-header`: the
    palette carries a `header` colour, so that name also resolves to a generated Tailwind utility.
  */
  .section-header {
    padding: 0.75rem 1rem;
    font-weight: 500;
    color: $primary;

    @at-root .body--light & {
      background-color: $grey-1;
      border-bottom: 1px solid $grey-3;
    }
    @at-root .body--dark & {
      // -> Same lightened brand blue as `.w-section-header`; `$primary` on this surface is ~2.7:1
      color: var(--color-primary-light);
      background-color: $dark-3;
      border-bottom: 1px solid $dark-2;
    }
  }

  /*
    A grey well for the cards to sit in, two shades under the sidebar beside it in both themes -- one
    shade was a white card on an all-but-white pane, which is no pane at all. It has to
    round the card's bottom-right corner itself: the card sets a radius but no `overflow: hidden` (the
    back button is positioned outside it), so a child with a background of its own paints straight
    over the curve. The two narrower layouts below restate the radius, since which corners this pane
    owns changes as the card stacks.
  */
  .w-page {
    flex: 1 1;
    min-width: 0;
    /*
      The positioning context for the loading veil inside it. Without one the veil finds the CARD --
      the nearest positioned ancestor -- and covers the tag list as well, so ticking a second tag
      meant reaching through a dimmed, `pointer-events`-blocked copy of the list to do it.
    */
    position: relative;
    /*
      Both right-hand corners, not just the lower one. This pane paints a background of its own and
      the card does not clip (`overflow: hidden` would cut off the back button positioned outside
      it), so a square corner here is painted straight over the card's curve -- which showed as a
      notch of grey outside the rounded corner of the header at the top of the pane.
    */
    border-radius: 0 7px 7px 0;

    .section-header:first-child {
      border-top-right-radius: 7px;
    }

    @at-root .body--light & {
      background-color: $pane-bg-light;
      border-left: 1px solid #fff;
    }
    @at-root .body--dark & {
      background-color: $pane-bg-dark;
      border-left: 1px solid rgba($dark-6, 0.75);
    }
  }

  /*
    THREE NARROWER LAYOUTS
    ======================

    The same three the search screen steps through, at the same widths -- below 1200px the card's
    gutters halve and the back button loses the room it was positioned into, below 900px the tag list
    becomes a disclosure above the results, and below 600px the card stops being a sheet and becomes
    the screen. Ordered narrowest-last so each overrides the one above it.
  */

  /* --- Below 1200px: the card gives up half its gutters ------------------------------------------- */
  @media (max-width: $card-gutter-max) {
    &-card {
      width: 95%;
      margin: 25px auto;
    }

    /* -> It is positioned into a 50px gutter that no longer exists; the header above still has the
          search field, and the browser still has its own Back */
    &-back {
      display: none;
    }
  }

  /* --- Below 900px: the tag list is a disclosure above the results -------------------------------- */
  @media (max-width: $list-collapse-max) {
    &-card {
      flex-direction: column;
    }

    &-listbtn {
      justify-content: space-between;
      border-radius: 7px 7px 0 0;

      @at-root .body--light & {
        background-color: $grey-1;
        border-bottom: 1px solid $grey-3;
      }
      @at-root .body--dark & {
        background-color: $dark-4;
        border-bottom: 1px solid $dark-2;
      }
    }

    /* -> The whole content of the button is one flex row, so the chevron needs pushing to the end */
    &-listbtn > span {
      flex: 1;
      justify-content: space-between;
    }

    /*
      And the panel's own heading goes: the disclosure button above it carries the same words, and
      "All Tags" twice over, one line apart, reads as a mistake rather than as a heading. Only the
      sidebar's -- the results pane keeps its own, which names a different thing.
    */
    &-sd .section-header {
      display: none;
    }

    &-listchevron {
      transition: transform 0.2s var(--ease-standard);

      &.is-open {
        transform: rotate(180deg);
      }
    }

    &-sd {
      flex: none;
      width: 100%;
      border-radius: 0;

      /* -> Stacked, there is no column beside this one for its right edge to divide it from */
      @at-root .body--light & {
        border-right: 0;
        border-bottom: 1px solid $grey-3;
      }
      @at-root .body--dark & {
        border-right: 0;
        border-bottom: 1px solid rgba(#fff, 0.12);
      }
    }

    /* -> A list that is now a drawer over the results rather than a column beside them, so it gets
          less of the window than it does as a sidebar */
    &-groups {
      max-height: 40vh;
    }

    /* -> Stacked, the pane is the bottom of the card and owns both of its bottom corners */
    .w-page {
      border-radius: 0 0 7px 7px;

      @at-root .body--light & {
        border-left: 0;
      }
      @at-root .body--dark & {
        border-left: 0;
      }

      .section-header:first-child {
        border-top-right-radius: 0;
      }
    }
  }

  /* --- Below 600px: the card is the screen -------------------------------------------------------- */
  @media (max-width: $breakpoint-xs-max) {
    &-card {
      width: 100%;
      margin: 0;
      border-radius: 0;
      box-shadow: none;
    }

    &-listbtn {
      border-radius: 0;
    }

    /* -> The card is the screen here, and has no corners left for the pane to follow */
    .w-page {
      border-radius: 0;
    }

    /* -> One column of cards, and the ordering controls take the width the field gave up */
    &-results {
      grid-template-columns: minmax(0, 1fr);
    }

    /* -> Full width rather than a 160px stub beside a wrapped row */
    &-locale {
      flex: 1 1 100%;
      width: auto;
    }

    &-orderby {
      flex: 1 1 100%;

      .w-select {
        flex: 1 1 auto;
        width: auto;
      }
    }
  }
}

/*
  The footer takes its dark form on this screen whatever the theme, because the ground it sits on is
  dark in both -- see the note on `.layout-tags`'s background. FooterNav paints itself light grey in
  the light theme, which everywhere else is right and here left a pale strip under a dark page.

  The same two values FooterNav's own dark rule uses, read from the same tokens so the two cannot
  drift; in the dark theme this simply restates what it already says. Three classes deep because that
  rule is scoped -- `.site-footer[data-v-...]` matches at two, and a tie would be settled by whichever
  stylesheet Vite happened to inject last.
*/
.layout-tags .w-footer .site-footer {
  background-color: var(--color-dark-4);
  color: rgb(255 255 255 / 0.4);
}

body.body--dark {
  background-color: $dark-6;
}
</style>
