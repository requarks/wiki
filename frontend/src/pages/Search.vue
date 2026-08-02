<template>
  <w-layout>
    <w-header><header-nav /></w-header>
    <w-page-container class="layout-search">
      <div class="layout-search-card">
        <w-btn
          class="layout-search-back"
          icon="la:arrow-circle-left"
          color="white"
          flat
          round
          @click="goBack">
          <w-tooltip anchor="center left" self="center right">{{
            t('common.actions.goback')
          }}</w-tooltip>
        </w-btn>
        <div class="layout-search-sd">
          <div class="section-header">{{ t('search.sortBy') }}</div>
          <w-list dense padding>
            <w-item
              v-for="item of orderByOptions"
              clickable
              :active="item.value === state.params.orderBy"
              @click="setOrderBy(item.value)">
              <w-item-section side>
                <w-icon
                  :name="item.icon"
                  :color="item.value === state.params.orderBy ? `primary` : ``" />
              </w-item-section>
              <w-item-section
                ><w-item-label>{{ item.label }}</w-item-label></w-item-section
              >
              <w-item-section v-if="item.value === state.params.orderBy" side>
                <w-icon
                  :name="
                    state.params.orderByDirection === `desc`
                      ? `mdi:transfer-down`
                      : `mdi:transfer-up`
                  "
                  size="sm"
                  color="primary" />
              </w-item-section>
            </w-item>
          </w-list>
          <div class="section-header">{{ t('search.filters') }}</div>
          <div class="p-2">
            <w-input
              outlined
              dense
              :placeholder="t(`search.filterPath`)"
              prefix="/"
              v-model="state.params.filterPath">
              <template #prepend>
                <w-icon name="la:caret-square-right" size="xs" />
              </template>
            </w-input>
            <w-select
              class="mt-2"
              outlined
              v-model="state.selectedTags"
              :options="tags"
              dense
              options-dense
              use-input
              use-chips
              multiple
              hide-dropdown-icon
              :aria-label="t(`search.filterTags`)"
              @update:model-value="(v) => syncTags(v)"
              :placeholder="state.selectedTags.length < 1 ? t(`search.filterTags`) : ``"
              :loading="state.loading > 0">
              <template #prepend><w-icon name="la:hashtag" size="xs" /></template>
            </w-select>
            <!-- q-input.q-mt-sm( -->
            <!-- outlined -->
            <!-- dense -->
            <!-- placeholder='Last updated...' -->
            <!-- ) -->
            <!-- template(v-slot:prepend) -->
            <!-- q-icon(name='la:calendar', size='xs') -->
            <!-- q-input.q-mt-sm( -->
            <!-- outlined -->
            <!-- dense -->
            <!-- placeholder='Last edited by...' -->
            <!-- ) -->
            <!-- template(v-slot:prepend) -->
            <!-- q-icon(name='la:user-edit', size='xs') -->
            <w-select
              class="mt-2"
              outlined
              v-model="state.params.filterLocale"
              emit-value
              map-options
              dense
              :aria-label="t(`search.filterLocale`)"
              :options="siteStore.locales.active"
              option-value="code"
              option-label="name"
              options-dense
              multiple
              :display-value="
                t(
                  `search.filterLocaleDisplay`,
                  {
                    n:
                      state.params.filterLocale.length > 0
                        ? state.params.filterLocale[0].toUpperCase()
                        : state.params.filterLocale.length
                  },
                  state.params.filterLocale.length
                )
              ">
              <template #prepend><w-icon name="la:language" size="xs" /></template>
            </w-select>
            <w-select
              class="mt-2"
              outlined
              v-model="state.params.filterEditor"
              emit-value
              map-options
              dense
              :aria-label="t(`search.filterEditor`)"
              :options="editors">
              <template #prepend><w-icon name="la:pen-nib" size="xs" /></template>
            </w-select>
            <w-select
              class="mt-2"
              outlined
              v-model="state.params.filterPublishState"
              emit-value
              map-options
              dense
              :aria-label="t(`search.filterPublishState`)"
              :options="publishStates">
              <template #prepend><w-icon name="la:traffic-light" size="xs" /></template>
            </w-select>
          </div>
        </div>
        <w-page>
          <div class="section-header flex">
            <span>{{ t('search.results') }}</span>
            <w-space />
            <transition name="slide-up" mode="out-in">
              <i18n-t
                class="text-caption"
                v-if="!siteStore.searchIsLoading"
                keypath="search.totalResults"
                tag="span"
                :plural="state.total">
                <strong>{{ state.total }}</strong>
              </i18n-t>
            </transition>
          </div>
          <div class="p-6" v-if="state.results.length < 1">
            <i18n-t
              keypath="search.noResults"
              tag="span"
              v-if="siteStore.search && siteStore.searchLastQuery">
              <strong>{{ siteStore.searchLastQuery }}</strong>
            </i18n-t>
            <span v-else
              ><em>{{ t('search.emptyQuery') }}</em></span
            >
          </div>
          <w-list separator>
            <w-item v-for="item of state.results" clickable :to="`/` + item.path">
              <w-item-section avatar>
                <w-avatar color="primary" text-color="white" rounded>
                  <w-icon :name="item.icon || defaultPageIcon" size="24px" />
                </w-avatar>
              </w-item-section>
              <w-item-section>
                <w-item-label>{{ item.title }}</w-item-label>
                <w-item-label v-if="item.description" caption>{{ item.description }}</w-item-label>
                <w-item-label class="text-grey" caption>/{{ item.path }}</w-item-label>
                <w-item-label class="text-highlight" v-if="item.highlight" caption>
                  <span v-html="item.highlight" />
                </w-item-label>
              </w-item-section>
              <w-item-section side>
                <div class="text-caption text-right">{{ humanizeDate(item.updatedAt) }}</div>
                <!--
                  `layout-search-itemtags` was a class nothing defines -- a leftover the layout
                  migration left behind -- so the row had no gap and the chips ran together.
                -->
                <div class="mt-1 flex flex-wrap items-center justify-end gap-1">
                  <w-chip
                    v-for="tag of item.tags"
                    :key="`tag-` + tag"
                    square
                    color="secondary"
                    text-color="white"
                    icon="la:hashtag"
                    size="sm"
                    >{{ tag }}</w-chip
                  >
                </div>
              </w-item-section>
            </w-item>
          </w-list>
        </w-page>
        <w-inner-loading :showing="state.loading > 0" />
      </div>
      <w-footer><footer-nav /></w-footer>
    </w-page-container>
    <main-overlay-dialog />
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'

import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'
import { DEFAULT_PAGE_ICON } from '@/stores/page'

import { debounce } from 'es-toolkit/function'
import { difference } from 'es-toolkit/array'
import HeaderNav from '@/components/HeaderNav.vue'
import FooterNav from '@/components/FooterNav.vue'
import MainOverlayDialog from '@/components/MainOverlayDialog.vue'

const tagsInQueryRgx = /#[a-z0-9-\u3400-\u4DBF\u4E00-\u9FFF]+(?=(?:[^"]*(?:")[^"]*(?:"))*[^"]*$)/g

/** How many results one search returns. The API caps this at 100, and there is no pager yet. */
const RESULTS_LIMIT = 100

// STORES

const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  titleTemplate: (title) => `${title} - ${t('profile.title')} - Wiki.js`
})

// DATA

const state = reactive({
  loading: 0,
  params: {
    filterPath: '',
    filterLocale: [],
    filterEditor: '',
    filterPublishState: '',
    orderBy: 'relevancy',
    orderByDirection: 'desc'
  },
  selectedTags: [],
  results: [],
  total: 0
})

const orderByOptions = computed(() => {
  return [
    { label: t('search.sortByRelevance'), value: 'relevancy', icon: 'la:stream' },
    { label: t('search.sortByTitle'), value: 'title', icon: 'la:heading' },
    { label: t('search.sortByLastUpdated'), value: 'updatedAt', icon: 'la:calendar' }
  ]
})

const editors = computed(() => {
  return [
    { label: t('search.editorAny'), value: '' },
    { label: 'AsciiDoc', value: 'asciidoc' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'Visual Editor', value: 'wysiwyg' }
  ]
})

const publishStates = computed(() => {
  return [
    { label: t('search.publishStateAny'), value: '' },
    { label: t('search.publishStateDraft'), value: 'draft' },
    { label: t('search.publishStatePublished'), value: 'published' },
    { label: t('search.publishStateScheduled'), value: 'scheduled' }
  ]
})

const tags = computed(() => siteStore.tags.map((t) => t.tag))

const defaultPageIcon = DEFAULT_PAGE_ICON

// WATCHERS

watch(
  () => route.query,
  async (newQueryObj) => {
    if (newQueryObj.q) {
      siteStore.search = newQueryObj.q.trim()
      syncTags()
      performSearch()
    }
  },
  { immediate: true }
)

watch(() => state.params, debounce(performSearch, 500), { deep: true })

// METHODS

function humanizeDate(val) {
  return userStore.formatDateTime(t, val)
}

function setOrderBy(val) {
  if (val === state.params.orderBy) {
    state.params.orderByDirection = state.params.orderByDirection === 'desc' ? 'asc' : 'desc'
  } else {
    state.params.orderBy = val
    state.params.orderByDirection = val === 'title' ? 'asc' : 'desc'
  }
}

function syncTags(newSelection) {
  const queryTags = Array.from(siteStore.search.matchAll(tagsInQueryRgx)).map((t) =>
    t[0].substring(1)
  )
  if (!newSelection) {
    state.selectedTags = queryTags
  } else {
    let newQuery = siteStore.search
    for (const tag of newSelection) {
      if (!newQuery.includes(`#${tag}`)) {
        newQuery = `${newQuery} #${tag}`
      }
    }
    for (const tag of difference(queryTags, newSelection)) {
      newQuery = newQuery.replaceAll(`#${tag}`, '')
    }
    newQuery = newQuery.replaceAll('  ', ' ').trim()
    router.replace({ path: '/_search', query: { q: newQuery } })
  }
}

async function performSearch() {
  let q = siteStore.search ?? ''

  // -> Extract tags
  const queryTags = Array.from(q.matchAll(tagsInQueryRgx)).map((t) => t[0].substring(1))
  for (const tag of queryTags) {
    q = q.replaceAll(`#${tag}`, '')
  }
  q = q.trim().replaceAll(/\s\s+/g, ' ')

  const filters = {
    ...(state.params.filterPath ? { path: state.params.filterPath } : {}),
    ...(queryTags.length > 0 ? { tags: queryTags.join(',') } : {}),
    ...(state.params.filterLocale.length > 0
      ? { locales: state.params.filterLocale.join(',') }
      : {}),
    ...(state.params.filterEditor ? { editor: state.params.filterEditor } : {}),
    ...(state.params.filterPublishState ? { publishState: state.params.filterPublishState } : {})
  }

  // -> Nothing to go on: the empty state says as much, and asking the server would answer with the
  //    most recently updated pages, which is not what an empty search box means
  if (!q && Object.keys(filters).length < 1) {
    state.results = []
    state.total = 0
    siteStore.searchLastQuery = siteStore.search
    siteStore.searchIsLoading = false
    return
  }

  state.loading++
  siteStore.searchIsLoading = true
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/search`, {
      searchParams: {
        ...(q ? { query: q } : {}),
        ...filters,
        orderBy: state.params.orderBy,
        orderByDirection: state.params.orderByDirection,
        // -> There is no pager yet, so this is as deep as the results go
        limit: RESULTS_LIMIT
      }
    }).json()
    state.results = (resp?.results ?? []).map((r) => ({ ...r, tags: [...(r.tags ?? [])].sort() }))
    state.total = resp?.totalHits ?? 0
    siteStore.searchLastQuery = siteStore.search
  } catch (err) {
    state.results = []
    state.total = 0
    notify({
      type: 'negative',
      message: t('search.failed'),
      caption:
        (await err.response
          ?.json()
          .then((b) => b?.message)
          .catch(() => null)) || err.message
    })
  } finally {
    state.loading--
    siteStore.searchIsLoading = false
  }
}

function goBack() {
  if (history.length > 0) {
    router.back()
  } else {
    router.push('/')
  }
}

// MOUNTED

onMounted(async () => {
  if (!siteStore.search) {
    siteStore.searchIsLoading = false
  }
  // -> The tag filter offers what the wiki actually uses, so the list has to be fetched; without it
  //    the dropdown is silently empty. Listing tags needs a session, and a reader without one still
  //    gets to search — they just filter by typing `#tag` instead of picking from the list
  if (userStore.authenticated) {
    try {
      await siteStore.fetchTags()
    } catch (err) {
      console.warn(err)
    }
  }
})

onUnmounted(() => {
  siteStore.search = ''
  siteStore.searchLastQuery = ''
  siteStore.searchIsLoading = false
})
</script>

<style lang="scss">
.layout-search {
  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  &:before {
    content: '';
    height: 200px;
    position: fixed;
    top: 0;
    width: 100%;
    background: radial-gradient(ellipse at bottom, $dark-3, $dark-6);
    border-bottom: 1px solid #fff;

    @at-root .body--dark & {
      border-bottom-color: $dark-3;
    }
  }

  &:after {
    content: '';
    height: 1px;
    position: fixed;
    top: 64px;
    width: 100%;
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 100%
    );
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
      No height of its own, as `.layout-profile-card` explains at length: the scrolling page container
      grows this into the height left over beside its margins, and lets its content take it past that.

      It used to say `height: 100%`, which overflowed the box by exactly its own margins on every
      search however few results came back -- so the footer under it started 100px below the fold --
      and, since a height is not a minimum, spilled a long result list out past the bottom edge of the
      white card the results are supposed to sit on.
    */

    /*
      A foreground to go with the background, as `.layout-profile-card` needs for the same reason:
      this card is a plain div rather than a WCard, and a WCard is what declares BOTH halves of a
      surface. With only the background set, everything inside inherited the document's black --
      headings, result titles, input and select values alike -- which is invisible on the dark one.
      The light value is the black it was already inheriting, so only dark mode changes.
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
    border-radius: 8px 0 0 8px;
    overflow: hidden;

    @at-root .body--light & {
      background-color: $grey-1;
      border-right: 1px solid rgba($dark-3, 0.1);
      box-shadow: inset -1px 0 0 #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-right: 1px solid rgba(#fff, 0.12);
      box-shadow: inset -1px 0 0 rgba($dark-6, 0.5);
    }
  }

  /*
    Primary, matching the section headers on the profile screen.

    This class was `text-header` until the rename, which collided with a GENERATED Tailwind utility:
    the palette carries a `header` colour, so `text-header` also meant `color: var(--color-header)` --
    #000 in both themes -- and that beat the card's inherited white. Renamed rather than fought, so the
    colour below is now a plain design choice instead of an override.
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

  .text-highlight {
    font-style: italic;

    > b {
      background-color: rgba($yellow-7, 0.5);
      border-radius: 3px;
    }
  }

  .w-page {
    flex: 1 1;

    .section-header:first-child {
      border-top-right-radius: 7px;
    }

    @at-root .body--light & {
      border-left: 1px solid #fff;
    }
    @at-root .body--dark & {
      border-left: 1px solid rgba($dark-6, 0.75);
    }
  }

  &-itemtags {
    .w-chip:last-child {
      margin-right: 0;
    }
  }
}

body.body--dark {
  background-color: $dark-6;
}

// -> The `.w-footer .q-bar` rule that used to sit here never matched: FooterNav renders
//    `.site-footer`, never a q-bar. Its colours live in FooterNav's own scoped style.
</style>
