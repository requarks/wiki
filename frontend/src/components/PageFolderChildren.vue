<template>
  <!--
    Nothing at all until there is something to list: most paths with no page are not folders either,
    and a heading over an empty box would announce a listing the reader is not about to get.
  -->
  <div v-if="state.items.length > 0" class="page-folder-children" :dir="dir">
    <div class="text-caption text-grey-6 mb-2 px-1">{{ t('common.newpage.children') }}</div>
    <w-list bordered separator>
      <!--
        One link per name. A page that also has a folder of pages under it opens the page, which is
        what its title names; a folder with no page at its path leads to this same screen one level
        down, where its own contents are listed in turn.
      -->
      <w-item v-for="item of state.items" :key="item.path" :to="`${localePrefix}/${item.path}`">
        <w-item-section avatar>
          <!-- -> The File Manager's folder, as the Browse menu draws it, so a folder looks the same
                  wherever the wiki shows one -->
          <w-icon v-if="!item.isPage" name="img:/_assets/icons/fluent-folder.svg" size="sm" />
          <w-icon v-else :name="item.icon || defaultPageIcon" size="sm" class="opacity-70" />
        </w-item-section>
        <w-item-section>
          <w-item-label class="truncate">{{ item.title }}</w-item-label>
          <!-- -> A path reads left to right whatever the language around it -->
          <w-item-label caption class="truncate font-robotomono">
            <span dir="ltr">/{{ item.path }}</span>
          </w-item-label>
        </w-item-section>
      </w-item>
    </w-list>
    <div v-if="state.truncated" class="text-caption text-grey-6 mt-2 px-1">
      {{ t('common.browse.truncated') }}
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'

import { apiErrorMessage } from '@/helpers/apiError'

import { useCommonStore } from '@/stores/common'
import { DEFAULT_PAGE_ICON, usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * What sits under a path that has no page of its own: the site's `listFolderChildren` feature, drawn
 * below the missing-page notice in `pages/Index.vue`.
 *
 * One level of `tree/browse`, the same listing the sidebar's Browse menu walks — pages and the
 * folders that hold some, a page and the folder at its path merged into one entry. **The filtering is
 * the server's**: it drops every entry the reader holds no `read:pages` rule for, and hidden and
 * unpublished pages for a reader with no session, before it answers. Nothing here hides anything.
 */

// STORES

const commonStore = useCommonStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const defaultPageIcon = DEFAULT_PAGE_ICON

const state = reactive({
  items: [],
  truncated: false,
  /** The locale the items were listed in, which is the one their links have to point into. */
  locale: ''
})

// COMPUTED

/** Chrome, so in the interface's direction rather than the missing page's. */
const dir = computed(() => siteStore.localeDir(commonStore.locale))

const localePrefix = computed(() => siteStore.localeUrlPrefix(state.locale))

// METHODS

/*
  Which fetch is the current one. Following a folder entry swaps the path under a mounted component,
  and an answer for the folder just left must not land over the one just entered.
*/
let latestRequest = 0

async function load() {
  const request = ++latestRequest
  const path = pageStore.path
  const locale = pageStore.locale
  state.items = []
  state.truncated = false
  // -> The site root is not a folder. A wiki with no home page has the Welcome screen there instead.
  if (!path) {
    return
  }
  try {
    const data = await API_CLIENT.get(`sites/${siteStore.id}/tree/browse`, {
      searchParams: { path, locale }
    }).json()
    if (request !== latestRequest) {
      return
    }
    state.locale = locale
    state.items = data.items ?? []
    state.truncated = Boolean(data.truncated)
  } catch (err) {
    // -> 404 is a path that is not a folder, which is most of them: nothing to list, nothing wrong
    if (request !== latestRequest || err.response?.status === 404) {
      return
    }
    notify({
      type: 'negative',
      message: t('common.newpage.childrenLoadFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

// MOUNTED

onMounted(load)

watch(() => [pageStore.path, pageStore.locale], load)
</script>

<style scoped>
/*
  Under the placeholder's button, in its centred column, but read as a list: left-aligned (start-
  aligned, on a right-to-left interface) and no wider than a line of titles needs to be.
*/
.page-folder-children {
  width: 100%;
  max-width: 32rem;
  margin-top: 2.5rem;
  text-align: start;
}
</style>
