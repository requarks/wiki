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
          @keyup.enter="onSearchEnter"
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
        <template v-if="siteStore.tagsLoaded && siteStore.tags.length > 0">
          <div class="searchpanel-header">
            <span>Popular Tags</span>
            <w-space />
            <w-btn class="acrylic-btn" flat label="View All" rounded size="xs" />
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
        <div class="searchpanel-header">Search Operators</div>
        <div class="searchpanel-tip">
          <code>!foo</code> or <code>-bar</code> to exclude "foo" and "bar".
        </div>
        <div class="searchpanel-tip">
          <code>bana*</code> for to match any term starting with "bana" (e.g. banana).
        </div>
        <div class="searchpanel-tip">
          <code>foo,bar</code> or <code>foo|bar</code> to search for "foo" OR "bar".
        </div>
        <div class="searchpanel-tip">
          <code>"foo bar"</code> to match exactly the phrase "foo bar".
        </div>
      </div>
    </div>
  </w-toolbar>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useSiteStore } from '@/stores/site'

import { orderBy } from 'es-toolkit/array'

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
  searchIsFocused: false
})

const searchPanel = ref(null)
const searchField = ref(null)

// COMPUTED

const searchPanelIsShown = computed(() => {
  return (
    state.searchIsFocused &&
    (siteStore.search !== siteStore.searchLastQuery || siteStore.search === '')
  )
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
  if (!import.meta.env.SSR) {
    window.removeEventListener('keydown', handleKeyPress)
  }
})

defineExpose({ focus })
</script>

<style lang="scss">
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
    padding: 0 0 0.5rem 0;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
  }

  &-tip {
    + .searchpanel-tip {
      margin-top: 0.5rem;
    }
  }

  code {
    background-color: rgba(0, 0, 0, 0.7);
    padding: 2px 8px;
    font-weight: 700;
    border-radius: 4px;
  }
}
</style>
