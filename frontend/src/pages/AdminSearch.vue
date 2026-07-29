<template>
  <w-page class="admin-flags">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-find-and-replace.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.search.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.search.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <w-btn
          class="mr-2 acrylic-btn"
          flat
          icon="mdi:database-refresh"
          :label="t(`admin.searchRebuildIndex`)"
          color="purple"
          @click="rebuild"
          :loading="state.rebuildLoading" />
        <w-separator class="mr-2" vertical />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/search`"
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
          :loading="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-7">
        <w-card class="py-2">
          <w-item tag="label">
            <blueprint-icon icon="search" />
            <w-item-section>
              <w-item-label>{{ t(`admin.search.highlighting`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.search.highlightingHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.termHighlighting"
                :aria-label="t(`admin.search.highlighting`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon class="self-start" icon="search" />
            <w-item-section>
              <w-item-label>{{ t(`admin.search.dictOverrides`) }}</w-item-label>
              <util-code-editor
                class="my-2"
                v-model="state.config.dictOverrides"
                language="json"
                :min-height="250"
                :aria-label="t(`admin.search.dictOverrides`)" />
              <w-item-label caption>
                <i18n-t keypath="admin.search.dictOverridesHint" tag="span">
                  <span>{ "en": "english" }</span>
                </i18n-t>
              </w-item-label>
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-12 max-lg:hidden lg:col-span-5">
        <div class="p-4 text-center">
          <img src="/_assets/illustrations/undraw_file_searching.svg" style="width: 80%" />
        </div>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useSiteStore } from '@/stores/site'

import UtilCodeEditor from '@/components/UtilCodeEditor.vue'

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.search.title')
})

// DATA

const state = reactive({
  loading: 0,
  rebuildLoading: false,
  availableDictionaries: [],
  config: {
    termHighlighting: false,
    // -> The editor works on text; the API stores and returns an object
    dictOverrides: '{}'
  }
})

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get('system/search').json()
    state.config = {
      termHighlighting: resp?.termHighlighting === true,
      dictOverrides: JSON.stringify(resp?.dictOverrides ?? {}, null, 2)
    }
    state.availableDictionaries = resp?.availableDictionaries ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.search.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  state.loading++
  try {
    let dictOverrides
    try {
      dictOverrides = JSON.parse(state.config.dictOverrides || '{}')
    } catch (err) {
      throw new Error(t('admin.search.dictOverridesInvalidJSON', { reason: err.message }))
    }
    if (
      typeof dictOverrides !== 'object' ||
      Array.isArray(dictOverrides) ||
      dictOverrides === null
    ) {
      throw new Error(t('admin.search.dictOverridesNotAnObject'))
    }
    // -> Caught here rather than server-side so the offending entry can be named while the operator
    //    is still looking at the editor
    for (const [locale, dictionary] of Object.entries(dictOverrides)) {
      if (typeof dictionary !== 'string' || !state.availableDictionaries.includes(dictionary)) {
        throw new Error(t('admin.search.dictOverridesUnknown', { locale, dictionary }))
      }
    }

    const resp = await API_CLIENT.put('system/search', {
      json: {
        termHighlighting: state.config.termHighlighting,
        dictOverrides
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.search.saveSuccess')
    })
    await load()
  } catch (err) {
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: t('admin.search.saveFailed'),
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

async function rebuild() {
  state.rebuildLoading = true
  try {
    const resp = await API_CLIENT.post('system/search/rebuild').json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.search.rebuildInitSuccess')
    })
  } catch (err) {
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: t('admin.search.rebuildFailed'),
      caption: apiMessage || err.message
    })
  }
  state.rebuildLoading = false
}

// MOUNTED

onMounted(async () => {
  load()
})
</script>

<style lang="scss"></style>
