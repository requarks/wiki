<template>
  <w-page class="admin-navigation">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-sidebar-menu.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.navigation.title') }}
        </div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.navigation.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex items-center">
        <!--
          Each view's own control sits left of the toggle -- the search filters the list of menus, Apply
          saves the configuration -- so that switching views leaves the toggle and the buttons where
          they were. The rule goes with whichever it is.
        -->
        <template v-if="state.displayMode === `menus`">
          <w-input
            class="denser mr-4"
            outlined
            v-model="state.search"
            dense
            :class="dark.isActive ? `bg-dark text-white` : `bg-white`">
            <template #prepend><w-icon class="opacity-50" name="la:search" size="20px" /></template>
          </w-input>
          <w-separator class="mr-4" vertical />
        </template>
        <template v-else>
          <w-btn
            class="mr-4"
            unelevated
            icon="mdi:check"
            :label="t(`common.actions.apply`)"
            color="secondary"
            @click="saveConfig"
            :loading="state.loading > 0" />
          <w-separator class="mr-4" vertical />
        </template>
        <w-btn-toggle
          class="mr-4"
          v-model="state.displayMode"
          push
          no-caps
          :toggle-color="dark.isActive ? `white` : `black`"
          :toggle-text-color="dark.isActive ? `black` : `white`"
          :text-color="dark.isActive ? `white` : `black`"
          :color="dark.isActive ? `dark-1` : `white`"
          :options="[
            { label: t('admin.navigation.menus'), value: 'menus' },
            { label: t('admin.navigation.config'), value: 'config' }
          ]" />
        <w-separator class="mr-4" vertical />
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/navigation`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :aria-label="t(`common.actions.refresh`)"
          @click="refresh"
          :loading="state.loading > 0">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
      </div>
    </div>
    <w-separator inset />
    <!-- ========================================== -->
    <!-- MENUS -->
    <!-- ========================================== -->
    <div class="grid grid-cols-12 p-4 gap-4" v-if="state.displayMode === `menus`">
      <div class="col-span-12">
        <!--
          A banner rather than an empty table, as the audit log has: a site with no menu yet is the
          normal state of one with no page yet, and worth saying how a menu comes to exist.
        -->
        <w-banner
          v-if="state.menus.length < 1 && state.loading < 1"
          rounded
          :class="dark.isActive ? `bg-dark-3 text-grey-4` : `bg-grey-2 text-grey-8`">
          {{ state.search ? t('admin.navigation.noneMatching') : t('admin.navigation.none') }}
        </w-banner>
        <w-card v-else>
          <w-table
            :rows="state.menus"
            :columns="headers"
            row-key="id"
            flat
            hide-header
            :loading="state.loading > 0">
            <template #body-cell-locale="props">
              <w-td :props="props">
                <w-chip
                  v-if="props.value"
                  class="text-caption"
                  square
                  color="grey-8"
                  text-color="white"
                  dense
                  >{{ siteStore.localeAlias(props.value) }}</w-chip
                >
              </w-td>
            </template>
            <template #body-cell-path="props">
              <w-td :props="props">
                <em class="text-grey" v-if="props.value === null">
                  {{ t('admin.navigation.orphaned') }}
                </em>
                <strong v-else>/{{ props.value }}</strong>
              </w-td>
            </template>
            <template #body-cell-items="props">
              <w-td :props="props">
                <w-chip
                  class="text-caption"
                  square
                  :color="dark.isActive ? `dark-6` : `grey-2`"
                  :text-color="dark.isActive ? `white` : `grey-8`"
                  dense
                  icon="la:bars"
                  >{{ t('admin.navigation.itemsCount', { count: props.value }) }}</w-chip
                >
              </w-td>
            </template>
            <template #body-cell-pages="props">
              <w-td :props="props">
                <w-chip
                  class="text-caption"
                  square
                  :color="dark.isActive ? `dark-6` : `grey-2`"
                  :text-color="dark.isActive ? `white` : `grey-8`"
                  dense
                  icon="la:file-alt"
                  >{{ t('admin.navigation.pagesCount', { count: props.value }) }}</w-chip
                >
              </w-td>
            </template>
            <template #body-cell-edit="props">
              <w-td :props="props">
                <w-btn
                  class="acrylic-btn mr-2"
                  flat
                  icon="la:pen"
                  :color="dark.isActive ? `indigo-4` : `indigo`"
                  :label="t(`common.actions.edit`)"
                  no-caps
                  @click="editMenu(props.row)" />
                <!--
                  Disabled rather than hidden for a locale's root menu: it is the one every page in
                  the locale falls back to, and the server refuses to delete it.
                -->
                <w-btn
                  class="acrylic-btn"
                  flat
                  icon="la:trash"
                  color="negative"
                  :disable="props.row.isRoot"
                  :aria-label="t(`admin.navigation.delete`)"
                  @click="deleteMenu(props.row)">
                  <w-tooltip v-if="props.row.isRoot">
                    {{ t('admin.navigation.deleteRootForbidden') }}
                  </w-tooltip>
                </w-btn>
              </w-td>
            </template>
          </w-table>
        </w-card>
        <div class="flex items-center justify-center mt-6" v-if="state.totalPages > 1">
          <w-pagination
            v-model="state.currentPage"
            :max="state.totalPages"
            :max-pages="9"
            boundary-numbers
            direction-links />
        </div>
      </div>
    </div>
    <!-- ========================================== -->
    <!-- CONFIGURATION -->
    <!-- ========================================== -->
    <div class="flex flex-wrap p-4 gap-4" v-else-if="state.displayMode === `config`">
      <div class="min-w-0 flex-1 flex flex-col gap-4">
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.navigation.general') }}
            <template #hint>{{ t('admin.navigation.generalHint') }}</template>
          </w-card-header>
          <w-item tag="label">
            <blueprint-icon class="self-start" icon="arrow-up" />
            <w-item-section>
              <w-item-label>{{ t(`admin.navigation.showParentLink`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.navigation.showParentLinkHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.showParentLink"
                :aria-label="t(`admin.navigation.showParentLink`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.navigation.automations') }}
            <template #hint>{{ t('admin.navigation.automationsHint') }}</template>
          </w-card-header>
          <!--
            From a list rather than written out seven times: every row is a toggle bound to one key of
            the site's `navigation` settings, named and explained by strings of the same key.
          -->
          <template v-for="(automation, idx) of automations" :key="automation.key">
            <w-separator v-if="idx > 0" class="my-2" inset />
            <w-item tag="label">
              <blueprint-icon class="self-start" :icon="automation.icon" />
              <w-item-section>
                <w-item-label>{{ t(`admin.navigation.${automation.key}`) }}</w-item-label>
                <w-item-label caption>{{
                  t(`admin.navigation.${automation.key}Hint`)
                }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-toggle
                  v-model="state.config[automation.key]"
                  :aria-label="t(`admin.navigation.${automation.key}`)" />
              </w-item-section>
            </w-item>
          </template>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { confirm } from '@/composables/dialog'
import { apiErrorMessage } from '@/helpers/apiError'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import { debounce } from 'es-toolkit/function'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.navigation.title')
}))

// DATA

const state = reactive({
  displayMode: 'menus',
  menus: [],
  loading: 0,
  search: '',
  currentPage: 1,
  pageSize: 20,
  totalPages: 1,
  // -> The site's `navigation` settings, as the Configuration view edits them
  config: {
    addPagesToParentMenu: false,
    removePagesFromParentMenu: false,
    migrateLinksOnMove: false,
    updateLabelsOnRename: false,
    createFolderMenus: false,
    deleteOrphanedMenus: false,
    includeStorageOperations: false,
    showParentLink: false
  }
})

/**
 * The Automations card, in the order it is drawn: what happens to a page, then to a folder, then the
 * sweep -- and last the switch that says whose changes the others answer to.
 */
const automations = [
  { key: 'addPagesToParentMenu', icon: 'new-document' },
  { key: 'removePagesFromParentMenu', icon: 'eraser' },
  { key: 'migrateLinksOnMove', icon: 'move-stock' },
  { key: 'updateLabelsOnRename', icon: 'rename' },
  { key: 'createFolderMenus', icon: 'add-folder' },
  { key: 'deleteOrphanedMenus', icon: 'trash' },
  { key: 'includeStorageOperations', icon: 'synchronize' }
]

/*
  A computed for the same reason as on the Users page: the locale strings can land after `setup()`
  has run, and a plain array would keep whatever `t()` answered before they did.
*/
const headers = computed(() => [
  {
    align: 'left',
    field: 'locale',
    name: 'locale',
    sortable: false,
    style: 'width: 80px'
  },
  {
    align: 'left',
    field: 'path',
    name: 'path',
    sortable: false
  },
  {
    align: 'left',
    field: 'itemCount',
    name: 'items',
    sortable: false,
    style: 'width: 120px'
  },
  {
    align: 'left',
    field: 'pageCount',
    name: 'pages',
    sortable: false,
    style: 'width: 170px'
  },
  {
    label: '',
    align: 'right',
    field: 'edit',
    name: 'edit',
    sortable: false,
    style: 'width: 250px'
  }
])

// WATCHERS

// -> The item count may have changed under the editor that just closed
watch(
  () => adminStore.overlay,
  (newValue, oldValue) => {
    if (!newValue && oldValue === 'NavEdit') {
      load()
    }
  }
)

watch(
  () => adminStore.currentSiteId,
  () => {
    load({ page: 1 })
    loadConfig()
  }
)

watch(
  () => state.search,
  debounce(() => {
    load({ page: 1 })
  }, 400)
)
watch(
  () => state.currentPage,
  (newValue) => {
    load({ page: newValue })
  }
)

// METHODS

async function load({ page } = {}) {
  if (!adminStore.currentSiteId) {
    return
  }
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}/navigation`, {
      searchParams: {
        ...(state.search ? { filter: state.search } : {}),
        page: page ?? state.currentPage ?? 1,
        limit: state.pageSize
      }
    }).json()
    state.totalPages = Math.max(1, Math.ceil((resp?.total ?? 0) / state.pageSize))
    state.menus = resp?.menus ?? []
    // -> Deleting the last row of the last page leaves that page empty; step back onto one that is not
    if (state.currentPage > state.totalPages) {
      state.currentPage = state.totalPages
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.navigation.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function loadConfig() {
  if (!adminStore.currentSiteId) {
    return
  }
  state.loading++
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json()
    state.config = { ...resp.navigation }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.navigation.configLoadFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function saveConfig() {
  state.loading++
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        navigation: state.config
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    // -> The sidebar draws "Go up" off this, so the site being read follows the save at once
    if (adminStore.currentSiteId === siteStore.id) {
      siteStore.navigation.showParentLink = Boolean(state.config.showParentLink)
    }
    notify({
      type: 'positive',
      message: t('admin.navigation.configSaveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.navigation.configSaveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

function refresh() {
  load()
  loadConfig()
}

function editMenu(menu) {
  adminStore.$patch({
    overlay: 'NavEdit',
    overlayOpts: {
      siteId: adminStore.currentSiteId,
      navId: menu.id,
      locale: menu.locale,
      title: menu.path === null ? '' : `/${menu.path} (${siteStore.localeAlias(menu.locale)})`
    }
  })
}

function deleteMenu(menu) {
  confirm({
    title: t('admin.navigation.delete'),
    icon: 'img:/_assets/icons/fluent-delete-bin.svg',
    message: t('admin.navigation.deleteConfirm', { path: `/${menu.path ?? ''}` }),
    cancel: true,
    persistent: true,
    color: 'negative',
    okLabel: t('common.actions.delete')
  }).onOk(async () => {
    state.loading++
    try {
      await API_CLIENT.delete(`sites/${adminStore.currentSiteId}/navigation/${menu.id}`).json()
      notify({
        type: 'positive',
        message: t('admin.navigation.deleteSuccess')
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: apiErrorMessage(err)
      })
    }
    state.loading--
    load()
  })
}

// MOUNTED

onMounted(() => {
  load({ page: 1 })
  loadConfig()
})

// BEFORE UNMOUNT

onBeforeUnmount(() => {
  adminStore.$patch({
    overlay: ''
  })
})
</script>
