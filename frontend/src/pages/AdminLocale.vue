<template>
  <w-page class="admin-locale">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-language.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.locale.title') }}
        </div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.locale.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <w-btn
          class="mr-2 acrylic-btn"
          flat
          icon="la:cloud-download-alt"
          :color="dark.isActive ? `indigo-4` : `indigo`"
          :label="t(`admin.locale.fetch`)"
          @click="fetchLocales">
          <w-tooltip>{{ t(`admin.locale.fetchHint`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          flat
          icon="la:file-upload"
          :color="dark.isActive ? `indigo-4` : `indigo`"
          :label="t(`admin.locale.installFile`)"
          :loading="state.uploading"
          :disabled="state.loading > 0 || state.uploading || Boolean(state.installing)"
          @click="promptInstallFile">
          <w-tooltip>{{ t(`admin.locale.installFileHint`) }}</w-tooltip>
        </w-btn>
        <w-separator class="mr-2" vertical />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/locale`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-7">
        <!-- ----------------------- -->
        <!-- Locale Options -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.locale.settings') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="translation" />
            <w-item-section>
              <w-item-label>{{ t(`admin.locale.primary`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.locale.primaryHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-select
                outlined
                v-model="state.primary"
                :options="primaryOptions"
                option-value="code"
                option-label="name"
                emit-value
                map-options
                dense
                :aria-label="t(`admin.locale.primary`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="close-pane" />
            <w-item-section>
              <w-item-label>{{ t(`admin.locale.forcePrefix`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.locale.forcePrefixHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.forcePrefix"
                :aria-label="t(`admin.locale.forcePrefixHint`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="geography" />
            <w-item-section>
              <w-item-label>{{ t(`admin.locale.showMenu`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.locale.showMenuHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle v-model="state.showMenu" :aria-label="t(`admin.locale.showMenuHint`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Active Locales -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>
            {{ t('admin.locale.active') }}
            <template #hint>{{ t('admin.locale.activeHint') }}</template>
          </w-card-header>
          <template v-for="(lc, idx) of orderedLocales" :key="lc.code">
            <w-separator v-if="idx === dividerIndex" class="my-2" inset />
            <!-- -> Not a label, unlike the toggles above: a label forwards a click to its FIRST
                    labelable descendant, and a button is one, so the whole row opened the alias
                    editor rather than flipping the toggle -->
            <w-item>
              <blueprint-icon :text="lc.language" />
              <w-item-section>
                <w-item-label>{{ lc.name }}</w-item-label>
                <w-item-label caption>{{ lc.nativeName }} ({{ lc.displayCode }})</w-item-label>
              </w-item-section>
              <!--
                Installing a locale is a site administrator's to do, but renaming one is not: the name
                and the short code are how every site on the instance addresses it, so the endpoint
                behind this button asks for `manage:system` and the button is offered to nobody else.
              -->
              <w-item-section v-if="lc.isInstalled && userStore.can(`manage:system`)" side>
                <w-btn
                  flat
                  dense
                  color="grey"
                  icon="la:pen"
                  :aria-label="t(`admin.locale.editAliases`)"
                  @click="editAliases(lc)">
                  <w-tooltip>{{ t(`admin.locale.editAliases`) }}</w-tooltip>
                </w-btn>
              </w-item-section>
              <w-item-section avatar>
                <w-toggle
                  v-if="lc.isInstalled"
                  :disable="lc.code === state.primary"
                  v-model="state.active"
                  :val="lc.code"
                  :aria-label="lc.name" />
                <w-btn
                  v-else
                  flat
                  color="primary"
                  icon="la:download"
                  :label="t(`admin.locale.install`)"
                  :loading="state.installing === lc.code"
                  :disabled="state.loading > 0 || Boolean(state.installing)"
                  @click="install(lc.code)" />
              </w-item-section>
            </w-item>
          </template>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-5">
        <div class="p-4">
          <!-- -> `mx-auto`, not the `text-center` that was here: preflight makes an img a block, so
                  centring it is a margin question rather than a text-align one -->
          <img src="/_assets/illustrations/undraw_world.svg" class="mx-auto" style="width: 80%" />
        </div>
      </div>
    </div>
    <input
      type="file"
      ref="localeFileIpt"
      accept=".json,application/json"
      style="display: none"
      @change="installFromFile" />
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { useDark } from '@/composables/dark'
import { dialog } from '@/composables/dialog'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import LocaleAliasesDialog from '@/components/LocaleAliasesDialog.vue'
import LocaleFetchDialog from '@/components/LocaleFetchDialog.vue'
import { apiErrorMessage } from '@/helpers/apiError'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { sortBy } from 'es-toolkit/array'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.locale.title')
}))

// DATA

const state = reactive({
  loading: 0,
  installing: null,
  uploading: false,
  locales: [],
  primary: 'en',
  forcePrefix: false,
  showMenu: true,
  active: []
})

// REFS

const localeFileIpt = ref(null)

// COMPUTED

// -> Installed first, so that the handful of locales this site can actually use is not buried among
//    the fifty-odd it merely could install. Each half keeps the alphabetical order `load` sorted it
//    into.
// -> A locale can only be the fallback for pages this site actually serves, so the choice is the
//    active ones — which are installed by definition, since only an installed locale may be activated
const primaryOptions = computed(() =>
  state.locales.filter((lc) => lc.isInstalled && state.active.includes(lc.code))
)

const orderedLocales = computed(() => [
  ...state.locales.filter((lc) => lc.isInstalled),
  ...state.locales.filter((lc) => !lc.isInstalled)
])

// -> The row the divider sits above; -1 when one of the two halves is empty and there is nothing to
//    divide
const dividerIndex = computed(() => {
  const idx = orderedLocales.value.findIndex((lc) => !lc.isInstalled)
  return idx > 0 ? idx : -1
})

// WATCHERS

watch(
  () => adminStore.currentSiteId,
  (newValue) => {
    load()
  }
)
// -> Selecting a primary locale that isn't active yet activates it, since its toggle is disabled
watch(
  () => state.primary,
  (newValue) => {
    if (newValue && !state.active.includes(newValue)) {
      state.active.push(newValue)
    }
  }
)

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    const [locales, site] = await Promise.all([
      API_CLIENT.get('locales').json(),
      API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json()
    ])
    state.locales = sortBy(locales ?? [], ['name', 'nativeName'])
    state.primary = site?.locales?.primary ?? 'en'
    state.forcePrefix = site?.locales?.forcePrefix ?? false
    state.showMenu = site?.locales?.showMenu ?? true
    state.active = [...(site?.locales?.active ?? [])]
    // -> The primary locale is always active, and its toggle is disabled to keep it that way
    if (!state.active.includes(state.primary)) {
      state.active.push(state.primary)
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.locale.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  if (state.loading > 0) {
    return
  }

  state.loading++
  try {
    // -> The primary locale is always active, even if the user just switched to an inactive one
    const active = [...new Set(state.active)]
    if (!active.includes(state.primary)) {
      active.push(state.primary)
    }
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        locales: {
          primary: state.primary,
          active,
          forcePrefix: state.forcePrefix,
          showMenu: state.showMenu
        }
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.locale.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    state.active = active
    notify({
      type: 'positive',
      message: t('admin.locale.saveSuccess')
    })
    await adminStore.fetchSites()
    if (adminStore.currentSiteId === siteStore.id) {
      siteStore.loadSite(window.location.hostname)
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

function fetchLocales() {
  dialog({
    component: LocaleFetchDialog
  }).onOk(() => {
    load()
  })
}

function editAliases(locale) {
  dialog({
    component: LocaleAliasesDialog,
    componentProps: { locale }
  }).onOk(() => {
    load()
  })
}

async function install(code) {
  if (state.installing) {
    return
  }
  state.installing = code
  try {
    await API_CLIENT.post(`locales/${code}/install`)
    notify({
      type: 'positive',
      message: t('admin.locale.installSuccess')
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.locale.installFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.installing = null
}

function promptInstallFile() {
  if (state.uploading) {
    return
  }
  // -> Cleared before rather than only after, so that picking the same file twice still fires
  //    `change` -- a failed upload the administrator wants to retry unchanged is the case
  localeFileIpt.value.value = null
  localeFileIpt.value.click()
}

/**
 * Install a locale from one of the published package files, carried in by hand.
 *
 * For a wiki that cannot reach github, where Fetch Updates has nothing to read. The body is the file
 * itself rather than a multipart form, and its NAME travels beside it in the query string because
 * that is what says which locale the strings are: `fr-FR.json` is `fr-FR`. The server is what judges
 * both -- `accept` on the input is a hint to the file picker and nothing more.
 */
async function installFromFile() {
  const file = localeFileIpt.value?.files?.[0]
  if (!file || state.uploading) {
    return
  }
  state.uploading = true
  try {
    const resp = await API_CLIENT.post('locales/upload', {
      searchParams: { fileName: file.name },
      headers: { 'content-type': 'application/json' },
      body: file
    }).json()
    // -> The API client does not throw on 400, so a refused file comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.locale.installFileSuccess', { code: resp.code })
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.locale.installFileFailed'),
      caption: apiErrorMessage(err)
    })
  }
  localeFileIpt.value.value = null
  state.uploading = false
}

// MOUNTED

onMounted(() => {
  if (adminStore.currentSiteId) {
    load()
  }
})
</script>
