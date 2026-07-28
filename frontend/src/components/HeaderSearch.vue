<template>
  <w-toolbar style="height: 64px;" v-if="siteStore.features.search">
    <!--
      The positioning context for the panel below, and the width it matches. The toolbar cannot be
      it: the panel would then span the toolbar's padding as well, and with no positioned ancestor
      at all it stretched to the whole window.
    -->
    <div class="header-search relative min-w-0 flex-1">
      <div class="header-search-field" :class="{ 'is-focused': state.searchIsFocused }">
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

        <button
          v-if="siteStore.search.length > 0"
          type="button"
          class="header-search-clear"
          :aria-label="t('common.actions.clear')"
          @click="clearSearch">
          <w-icon name="la:times" />
        </button>
        <!--
          The shortcut hint doubles as the focus affordance, so it gives way to whatever the field
          has to say once it is in use.
        -->
        <span
          v-if="!state.searchIsFocused"
          class="header-search-kbd"
          aria-hidden="true"
          @click="searchField.focus()">
          Ctrl+K
        </span>
        <span
          v-else-if="siteStore.search && siteStore.search !== siteStore.searchLastQuery"
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
        <div class="searchpanel-tip"><code>!foo</code> or <code>-bar</code> to exclude "foo" and "bar".</div>
        <div class="searchpanel-tip"><code>bana*</code> for to match any term starting with "bana" (e.g. banana).</div>
        <div class="searchpanel-tip"><code>foo,bar</code> or <code>foo|bar</code> to search for "foo" OR "bar".</div>
        <div class="searchpanel-tip"><code>"foo bar"</code> to match exactly the phrase "foo bar".</div>
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

function handleKeyPress(ev) {
  if (siteStore.features.search) {
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
    In use, the field inverts: white fill, dark ink. Driven by a class rather than `:focus-within`
    so it stays inverted while the panel below is being used -- clicking a tag in there moves focus
    out of the input, and the field flickering back to dark mid-interaction reads as a glitch.
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
*/
.searchpanel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 10;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
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
