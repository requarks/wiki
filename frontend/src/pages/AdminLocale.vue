<template>
  <w-page class="admin-locale">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-language.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.locale.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.locale.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/localisation`"
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
                :options="state.locales"
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
            <template #hint>Select the locales that can be used on this site.</template>
          </w-card-header>
          <w-item
            v-for="lc of state.locales"
            :key="lc.code"
            :tag="lc.code !== state.selectedLocale ? `label` : null">
            <blueprint-icon :text="lc.language" />
            <w-item-section>
              <w-item-label>{{ lc.nativeName }}</w-item-label>
              <w-item-label caption>{{ lc.name }} ({{ lc.code }})</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                :disable="lc.code === state.primary"
                v-model="state.active"
                :val="lc.code"
                :aria-label="lc.name" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-5">
        <div class="p-4 text-center">
          <img src="/_assets/illustrations/undraw_world.svg" style="width: 80%" />
        </div>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, watch } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import { sortBy } from 'es-toolkit/array'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.locale.title')
})

// DATA

const state = reactive({
  loading: 0,
  locales: [],
  primary: 'en',
  forcePrefix: false,
  showMenu: true,
  active: []
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
    state.locales = sortBy(locales ?? [], ['nativeName', 'name'])
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

// MOUNTED

onMounted(() => {
  if (adminStore.currentSiteId) {
    load()
  }
})
</script>
