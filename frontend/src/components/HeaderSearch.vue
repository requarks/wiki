<template>
  <!--
    `row` is the phone form: the field is not squeezed between the site title and the header's
    buttons but has a row of the whole width to itself, opened from a search button. Slightly
    shorter than the header proper, so the two read as a bar and a drawer under it rather than as
    two headers.
  -->
  <w-toolbar :style="{ height: row ? `52px` : `64px` }" v-if="siteStore.features.search">
    <!--
      The positioning context for the panel below, and the width it matches. The toolbar cannot be
      it: the panel would then span the toolbar's padding as well, and with no positioned ancestor
      at all it stretched to the whole window.

      Full toolbar height rather than just the field's, with the field centred inside it, so that
      `top: 100%` on the panel lands on the bottom edge of the header instead of 12px above it.
    -->
    <div class="header-search relative flex h-full min-w-0 flex-1 flex-col justify-center">
      <div
        class="header-search-field"
        :class="{ 'is-focused': state.searchIsFocused, 'header-search-field--row': row }">
        <w-circular-progress
          v-if="siteStore.searchIsLoading && route.path !== `/_search`"
          class="header-search-lead"
          instant-feedback
          indeterminate
          rounded
          color="primary"
          size="18px" />
        <w-icon v-else class="header-search-lead" name="la:search" />

        <input
          ref="searchField"
          v-model="siteStore.search"
          type="text"
          class="header-search-input"
          :placeholder="t('common.header.search')"
          :aria-label="t('common.header.search')"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="suggestionsAreShown"
          :aria-controls="suggestionsAreShown ? suggestionsId : undefined"
          :aria-activedescendant="
            suggestionsAreShown && state.activeIndex >= 0
              ? `${suggestionsId}-${state.activeIndex}`
              : undefined
          "
          @keydown="onSearchKeydown"
          @focus="state.searchIsFocused = true"
          @blur="checkSearchFocus" />

        <!--
          `mousedown.prevent` keeps the press from pulling focus out of the input: the blur would
          swap the badge to its right (see below) and the resulting reflow shifts this button out
          from under the pointer before it can be released, eating the click.
        -->
        <button
          v-if="siteStore.search.length > 0"
          type="button"
          class="header-search-clear"
          :aria-label="t('common.actions.clear')"
          @mousedown.prevent
          @click="clearSearch">
          <w-icon name="la:times" />
        </button>
        <!--
          The shortcut hint doubles as the focus affordance, so it gives way to whatever the field
          has to say once it is in use.

          Never in `row` form: that is the phone field, opened by a button, and a keyboard shortcut is
          not something the device it exists for can offer. The focus test moves onto the branch below,
          which the chain used to get for free from this one.
        -->
        <span
          v-if="!row && !state.searchIsFocused"
          class="header-search-kbd"
          aria-hidden="true"
          @click="searchField.focus()">
          Ctrl+K
        </span>
        <span
          v-else-if="
            state.searchIsFocused &&
            siteStore.search &&
            siteStore.search !== siteStore.searchLastQuery
          "
          class="header-search-kbd">
          Press Enter
        </span>
      </div>

      <div class="searchpanel" ref="searchPanel" v-if="searchPanelIsShown">
        <!--
          Pages whose title or path matches what has been typed, in place of the tags and the tips
          while there are any: the panel is a dropdown under a text field, and one that kept growing
          as the reader typed would push the suggestions down out of reach.

          Real links, so that a middle click opens one in a new tab. `mousedown.prevent` keeps the
          press from blurring the input, which would close the panel before the click lands.
        -->
        <template v-if="suggestionsAreShown">
          <div class="searchpanel-header">{{ t('common.header.searchSuggestions') }}</div>
          <div :id="suggestionsId" class="searchpanel-suggestions" role="listbox">
            <router-link
              v-for="(item, idx) of state.suggestions"
              :key="item.id"
              :id="`${suggestionsId}-${idx}`"
              :to="pageUrl(item)"
              class="searchpanel-suggestion"
              :class="{ 'is-active': idx === state.activeIndex }"
              role="option"
              :aria-selected="idx === state.activeIndex"
              @mousedown.prevent
              @mouseenter="state.activeIndex = idx"
              @click="closeAfterNavigation">
              <w-icon class="searchpanel-suggestion-icon" :name="item.icon || DEFAULT_PAGE_ICON" />
              <span class="searchpanel-suggestion-text">
                <span class="searchpanel-suggestion-title">{{ item.title }}</span>
                <span class="searchpanel-suggestion-path">{{ pageUrl(item) }}</span>
              </span>
            </router-link>
          </div>
        </template>
        <template v-else-if="siteStore.tagsLoaded && siteStore.tags.length > 0">
          <div class="searchpanel-header">
            <span>Popular Tags</span>
            <w-space />
            <!--
              `mousedown.prevent` for the same reason the clear button has it: the press would
              otherwise blur the input, which closes this panel before the click lands.
            -->
            <w-btn
              class="acrylic-btn"
              flat
              label="View All"
              size="xs"
              @mousedown.prevent
              @click="viewAllTags" />
          </div>
          <div class="mb-4 flex flex-wrap gap-1">
            <w-chip
              v-for="tag of popularTags"
              :key="tag"
              square
              color="grey-8"
              text-color="white"
              icon="la:hashtag"
              size="sm"
              clickable
              @click="addTag(tag)">
              {{ tag }}
            </w-chip>
          </div>
        </template>
        <template v-if="!suggestionsAreShown">
          <div class="searchpanel-header">Search Operators</div>
          <div class="searchpanel-tips">
            <div class="searchpanel-tip">
              <code>!foo</code> or <code>-bar</code> to exclude "foo" and "bar".
            </div>
            <div class="searchpanel-tip">
              <code>foo*</code> to match any term starting with "foo".
            </div>
            <div class="searchpanel-tip">
              <code>foo,bar</code> or <code>foo|bar</code> to search for "foo" OR "bar".
            </div>
            <div class="searchpanel-tip">
              <code>"foo bar"</code> to match exactly the phrase "foo bar".
            </div>
          </div>
        </template>
      </div>
    </div>
  </w-toolbar>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { DEFAULT_PAGE_ICON } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { orderBy } from 'es-toolkit/array'
import { debounce } from 'es-toolkit/function'

/** Characters typed before pages are suggested. One matches nearly every title on the wiki. */
const SUGGEST_MIN_LENGTH = 2
const SUGGEST_LIMIT = 8
/** Long enough that a word typed at speed is one request, short enough not to read as lag. */
const SUGGEST_DEBOUNCE_MS = 150

// PROPS

const props = defineProps({
  /**
   * Render as a row of its own rather than inline in the header bar. What the phone header opens;
   * see `HeaderNav`.
   */
  row: {
    type: Boolean,
    default: false
  }
})

// STORES

const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  searchIsFocused: false,
  suggestions: [],
  /** The suggestion the arrow keys are on, or -1 for the field itself. */
  activeIndex: -1,
  /** Escape put the suggestions away. Typing anything brings them back. */
  suggestionsDismissed: false
})

const suggestionsId = useId()
/** The suggestion request in flight, aborted when a newer one replaces it. */
let suggestAbort = null

const searchPanel = ref(null)
const searchField = ref(null)

// COMPUTED

const searchPanelIsShown = computed(() => {
  return (
    state.searchIsFocused &&
    (siteStore.search !== siteStore.searchLastQuery || siteStore.search === '')
  )
})

/**
 * What the suggestions are asked about: the words of the query, without what only means something to
 * the full search -- `#tags`, `-excluded` and `!excluded` words, and the quote, prefix and OR operators.
 *
 * Empty while the field is not focused, so that a query put in the field by the search page's own URL
 * asks for nothing, and so that focusing the field again asks afresh.
 */
const suggestionQuery = computed(() => {
  if (!state.searchIsFocused) {
    return ''
  }
  const query = siteStore.search
    .replace(/[",|]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !/^[#!-]/.test(word))
    .map((word) => word.replaceAll('*', ''))
    .filter(Boolean)
    .join(' ')
  return query.length >= SUGGEST_MIN_LENGTH ? query : ''
})

/*
  The previous list stays up while the next one loads, rather than the panel flickering back to the
  tags and tips on every keystroke. It is only dropped when there is nothing left to ask about.
*/
const suggestionsAreShown = computed(() => {
  return searchPanelIsShown.value && !state.suggestionsDismissed && state.suggestions.length > 0
})

const popularTags = computed(() => {
  /*
    FIXME: this sorts tags ASCENDING by usage, which is almost certainly not what was meant.
    `['usageCount', 'desc']` was passed where lodash expects the list of KEYS to sort by, so it read
    as "order by usageCount, then by a property named desc" -- both ascending. Carried across
    unchanged, with the orders now written out, because fixing it is a behaviour change.
  */
  return orderBy(siteStore.tags, ['usageCount', 'desc'], ['asc', 'asc']).map((t) => t.tag)
})

// WATCHERS

watch(searchPanelIsShown, (newValue) => {
  if (newValue) {
    siteStore.fetchTags()
  }
})

watch(suggestionQuery, (query) => {
  if (query) {
    loadSuggestions(query)
  } else {
    loadSuggestions.cancel()
    suggestAbort?.abort()
    state.suggestions = []
    state.activeIndex = -1
  }
})

watch(
  () => siteStore.search,
  () => {
    state.suggestionsDismissed = false
  }
)

// METHODS

/*
  Ctrl+K focuses the field -- unless a full-screen overlay is up, in which case this header is behind
  it and the shortcut belongs to whatever is in front. FileManager has a search field of its own and
  claims it; the rest simply have nothing to focus, and pulling focus into a field the user cannot see
  is worse than the key doing nothing.
*/
function handleKeyPress(ev) {
  if (siteStore.features.search && !siteStore.overlayIsShown) {
    if (ev.ctrlKey && ev.key === 'k') {
      ev.preventDefault()
      searchField.value.focus()
    }
  }
}

const loadSuggestions = debounce(async (query) => {
  suggestAbort?.abort()
  const controller = new AbortController()
  suggestAbort = controller
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/suggest`, {
      searchParams: { query, locale: siteStore.readerLocale, limit: SUGGEST_LIMIT },
      signal: controller.signal
    }).json()
    if (suggestAbort === controller) {
      state.suggestions = resp?.results ?? []
      state.activeIndex = -1
    }
  } catch {
    // -> Superseded, or failed. Either way there is nothing to suggest, and the full search is still
    //    one Enter away -- a failure here is not worth an error over the reader's typing.
    if (suggestAbort === controller) {
      state.suggestions = []
      state.activeIndex = -1
    }
  }
}, SUGGEST_DEBOUNCE_MS)

/** Where a suggestion leads: the page's address in its own locale, as on the search page. */
function pageUrl(item) {
  return `${siteStore.localeUrlPrefix(item.locale)}/${item.path}`
}

/**
 * The arrow keys move through the suggestions, and Enter opens the one they are on -- or runs the full
 * search when they are on none, which is what Enter always did.
 *
 * Down from the last suggestion goes back to the field, and Up from the field to the last suggestion,
 * so there is always a way back to plain typing. Keydown rather than keyup so that the arrows can stop
 * the caret moving, and so that Enter can be ignored mid-composition: an IME commits with Enter, and
 * that keypress is not a search.
 */
function onSearchKeydown(ev) {
  if (ev.isComposing) {
    return
  }
  const count = suggestionsAreShown.value ? state.suggestions.length : 0
  switch (ev.key) {
    case 'ArrowDown':
      if (count > 0) {
        ev.preventDefault()
        state.activeIndex = state.activeIndex >= count - 1 ? -1 : state.activeIndex + 1
      }
      break
    case 'ArrowUp':
      if (count > 0) {
        ev.preventDefault()
        state.activeIndex = state.activeIndex < 0 ? count - 1 : state.activeIndex - 1
      }
      break
    case 'Escape':
      if (count > 0) {
        ev.preventDefault()
        state.suggestionsDismissed = true
        state.activeIndex = -1
      }
      break
    case 'Enter':
      if (count > 0 && state.activeIndex >= 0) {
        ev.preventDefault()
        router.push(pageUrl(state.suggestions[state.activeIndex]))
        closeAfterNavigation()
      } else {
        onSearchEnter()
      }
      break
  }
}

/**
 * Empty the field and let go of it once a suggestion has been followed: what was typed was a way of
 * finding that page, not a query to come back to.
 *
 * Not for a click that opens the link somewhere else -- a modifier key means a new tab or window, and
 * the reader is still here with the list in front of them.
 */
function closeAfterNavigation(ev) {
  if (ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey)) {
    return
  }
  siteStore.search = ''
  state.suggestions = []
  state.activeIndex = -1
  searchField.value?.blur()
}

function onSearchEnter() {
  if (!siteStore.search) {
    return
  }
  if (route.path === '/_search') {
    router.replace({ path: '/_search', query: { q: siteStore.search } })
  } else {
    siteStore.searchIsLoading = true
    router.push({ path: '/_search', query: { q: siteStore.search } })
  }
}

function checkSearchFocus(ev) {
  if (!searchPanel.value?.contains(ev.relatedTarget)) {
    state.searchIsFocused = false
  }
}

/**
 * Put the caret in the field.
 *
 * Exposed because in `row` form the field is not focused by being mounted: focusing it is what draws
 * the panel below it, and a panel appearing mid-slide is layout and a `backdrop-filter` blur landing
 * in the middle of an animation. `HeaderNav` owns that transition, so it calls this when the slide has
 * finished -- see its `@after-enter`.
 */
function focus() {
  searchField.value?.focus()
}

function clearSearch() {
  siteStore.search = ''
  searchField.value.focus()
}

/** The tag browser, which is what this panel's handful of popular ones is a shortcut into. */
function viewAllTags() {
  state.searchIsFocused = false
  router.push('/_tags')
}

function addTag(tag) {
  if (!siteStore.search.includes(`#${tag}`)) {
    siteStore.search = siteStore.search ? `${siteStore.search} #${tag}` : `#${tag}`
  }
  searchField.value.focus()
}

// MOUNTED

onMounted(() => {
  if (!import.meta.env.SSR) {
    window.addEventListener('keydown', handleKeyPress)
  }
  if (route.path.startsWith('/_search')) {
    searchField.value.focus()
  }
})
onBeforeUnmount(() => {
  loadSuggestions.cancel()
  suggestAbort?.abort()
  if (!import.meta.env.SSR) {
    window.removeEventListener('keydown', handleKeyPress)
  }
})

defineExpose({ focus })
</script>

<style lang="scss">
/*
  Where the operator tips fall back to a single column. This panel's own threshold rather than one of
  the app's `--breakpoint-*`: the panel is as wide as the search field, which is whatever the header
  has left over after the site title and its buttons -- so it only has room for two columns of tips
  on a very wide window. Stated as a `max` value just under 2000px, the way the shared ones are.
*/
$tips-single-column-max: 1999.98px;

/* The gap between a panel title and the rule under it, which the View All button has to cancel. */
$searchpanel-header-gap: 0.15rem;

/*
  The header search box.

  Deliberately not built on WInput: that is a form field -- label, hint line, error line, inset
  focus ring -- and this is none of those. It is a pill on a dark bar that inverts when you use it,
  so it owns its own markup and styling rather than fighting a component's.
*/
.header-search {
  &-field {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 8px 0 12px;
    border-radius: 9999px;
    background-color: #212121;
    color: rgba(255, 255, 255, 0.85);
    transition:
      background-color 0.25s var(--ease-standard),
      color 0.25s var(--ease-standard);
  }

  /*
    In `row` form, a wash of black over whatever is behind rather than a grey of its own.

    The row is the site's sidebar colour (see `HeaderNav`), which is the site's to choose -- so a fixed
    grey is a slab of a foreign colour sitting on it, right for one theme and wrong for the rest. A
    translucent black darkens whatever it is given and reads as a well sunk into the row on any of them.

    The inline form keeps its grey: it sits on the HEADER, which is black by default, and a translucent
    black on black is no field at all.
  */
  &-field--row {
    background-color: rgb(0 0 0 / 0.25);
  }

  /*
    In use, the field inverts: white fill, dark ink. Driven by a class rather than `:focus-within`
    so it stays inverted while the panel below is being used -- clicking a tag in there moves focus
    out of the input, and the field flickering back to dark mid-interaction reads as a glitch.

    Two classes, so this outranks the `--row` wash above whichever order they end up in.
  */
  &-field.is-focused {
    background-color: #fff;
    color: rgba(0, 0, 0, 0.87);
  }

  &-lead {
    flex-shrink: 0;
    font-size: 20px;
    opacity: 0.7;
  }

  &-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    outline: none;

    &::placeholder {
      color: currentColor;
      opacity: 0.55;
    }
    /* -> the UA's own clear affordance would sit beside ours */
    &::-webkit-search-cancel-button {
      display: none;
    }
  }

  &-clear {
    flex-shrink: 0;
    display: inline-flex;
    padding: 4px;
    border-radius: 9999px;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;

    &:hover {
      opacity: 1;
    }
  }

  /* Sits inside the pill, against its fill, so it inverts with everything else */
  &-kbd {
    flex-shrink: 0;
    /* -> pulls it clear of the pill's edge, where the two mismatched radii read as a kink */
    margin-right: 2px;
    padding: 2px 8px;
    border: 1px solid currentColor;
    border-radius: 9999px;
    font-size: 11px;
    line-height: 1.4;
    white-space: nowrap;
    opacity: 0.5;
    cursor: pointer;
    user-select: none;
  }
}

/*
  Hangs off the field, matching its width -- `left: 0; right: 0` against the wrapper rather than a
  width of its own, so the two cannot drift apart.

  The wrapper is the full height of the header, so `top: 100%` puts the panel flush against its
  bottom edge; square top corners then read as a continuation of the header rather than a card
  floating under it.
*/
.searchpanel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 0 0 12px 12px;
  color: #fff;
  padding: 0.5rem 1rem 1rem;
  backdrop-filter: blur(7px) saturate(180%);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.2),
    0 1px 1px rgba(0, 0, 0, 0.14),
    0 2px 1px -1px rgba(0, 0, 0, 0.12);

  &-header {
    font-weight: 500;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0 0 $searchpanel-header-gap 0;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;

    /*
      View All sits ON the rule rather than above it: it gives back the title's bottom gap and squares
      its lower corners, so the button's own edge and the rule read as one line -- a tab on the rule
      rather than a pill floating over it. Hence no `rounded` prop on the button either: all four
      corners are this rule's to set, and a pill's 28px would fight the two it keeps.

      `flex-end` rather than the header's `center` because the negative margin shrinks the button's
      outer box -- centred, half of it would be taken up by the centring and the button would come to
      rest short of the rule.
    */
    .acrylic-btn {
      align-self: flex-end;
      margin-bottom: -$searchpanel-header-gap;
      border-radius: 5px 5px 0 0;
    }
  }

  /*
    The separator is a pseudo-element on the grid rather than a border on the right-hand column: with
    a row gap between the tips, a per-cell border would come out as one dash per row instead of a
    single line down the middle of the gutter.
  */
  &-tips {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 1.5rem;
    row-gap: 0.35rem;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: calc(50% - 0.5px);
      width: 1px;
      background-color: rgba(255, 255, 255, 0.15);
    }

    /* Below 2000px the tips stack, and the separator has nothing left to separate. */
    @media (max-width: $tips-single-column-max) {
      grid-template-columns: 1fr;

      &::before {
        content: none;
      }
    }
  }

  &-tip {
    font-size: 0.75rem;
    line-height: 1.4;
  }

  &-suggestions {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /*
    Pulled out by its own padding so that the highlight reaches the panel's gutter while the icons
    stay in line with the heading above them. One highlight for the pointer and the arrow keys alike:
    hovering moves `activeIndex`, so the two can never point at different rows.
  */
  &-suggestion {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0 -0.5rem;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    color: inherit;
    text-decoration: none;

    &.is-active {
      background-color: rgba(255, 255, 255, 0.12);
    }

    &-icon {
      flex-shrink: 0;
      font-size: 20px;
      opacity: 0.8;
    }

    &-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    &-title,
    &-path {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.3;
    }

    &-title {
      font-size: 0.875rem;
    }

    &-path {
      font-size: 0.75rem;
      opacity: 0.6;
    }
  }

  /*
    Colour alone rather than a chip: the tips are one line each and mostly operator, so a filled
    background on every other word made the column read as a row of buttons. `primary-lighter` and
    not `primary` because the panel is a wash of black in either theme -- the mid-tone is picked to
    read on white, and even the heading shade is dim at this size.
  */
  code {
    color: var(--color-primary-lighter);
  }
}
</style>
