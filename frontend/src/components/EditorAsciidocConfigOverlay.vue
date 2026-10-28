<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/ultraviolet-asciidoc.svg" left size="md" />
      <span>{{ t(`admin.editors.asciidocName`) }}</span>
      <w-space />
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.refresh`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/admin/editors/asciidoc`"
        target="_blank"
        type="a" />
      <w-btn-group push>
        <w-btn
          push
          color="grey-6"
          text-color="white"
          :aria-label="t(`common.actions.refresh`)"
          icon="la:redo-alt"
          @click="load"
          :loading="state.loading > 0">
          <w-tooltip anchor="center left" self="center right">{{
            t(`common.actions.refresh`)
          }}</w-tooltip>
        </w-btn>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.cancel`)"
          :aria-label="t(`common.actions.cancel`)"
          icon="la:times"
          @click="close" />
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(`common.actions.save`)"
          :aria-label="t(`common.actions.save`)"
          icon="la:check"
          @click="save"
          :disabled="state.loading > 0" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <w-page class="p-4" style="max-width: 1200px; margin: 0 auto">
        <w-card class="shadow-1 pb-2">
          <w-card-section>
            <div class="text-subtitle1">{{ t('admin.editors.asciidoc.general') }}</div>
          </w-card-section>
          <w-item>
            <blueprint-icon icon="math" />
            <w-item-section>
              <w-item-label>{{ t(`admin.editors.asciidoc.math`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.editors.asciidoc.mathHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-select
                style="width: 200px"
                outlined
                v-model="state.config.math"
                :options="mathEngines"
                emit-value
                map-options
                dense
                options-dense
                :aria-label="t(`admin.editors.asciidoc.math`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="right-navigation-toolbar" />
            <w-item-section>
              <w-item-label>{{ t(`admin.editors.asciidoc.minimap`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.editors.asciidoc.minimapHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.minimap"
                color="primary"
                checked-icon="la:check"
                unchecked-icon="la:times"
                :aria-label="t(`admin.editors.asciidoc.minimap`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <w-inner-loading :showing="state.loading > 0" spinner-class="text-accent" />
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'

import { useAdminStore } from '@/stores/admin'
import { useEditorStore } from '@/stores/editor'
import { useSiteStore } from '@/stores/site'

import { toMerged } from 'es-toolkit/object'

/**
 * The AsciiDoc editor's settings for one site.
 *
 * Only what AsciiDoc does not decide for itself: its text replacements and autolinking are part of
 * the language rather than options, and most of the rest is spelled per block. What is left is which
 * block draws a `latexmath` or `stem` formula -- see `AsciidocRenderer` -- and, about the editor rather
 * than the language, whether it shows a minimap.
 */

// STORES

const adminStore = useAdminStore()
const editorStore = useEditorStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

/**
 * Fallbacks for options a site may not have stored yet, so that every control renders with a
 * defined value. Must mirror the AsciiDoc defaults used by the backend when creating a site.
 */
function defaultConfig() {
  return {
    math: 'katex',
    minimap: false
  }
}

const state = reactive({
  config: defaultConfig(),
  loading: 0
})

// -> The names of the two blocks are product names, and are not translated
const mathEngines = computed(() => [
  { value: 'off', label: t('admin.editors.asciidoc.mathOff') },
  { value: 'katex', label: 'KaTeX' },
  { value: 'mathjax', label: 'MathJax' }
])

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json()
    if (!resp?.editors?.asciidoc?.config) {
      throw new Error('Failed to fetch AsciiDoc editor configuration.')
    }
    state.config = toMerged(defaultConfig(), resp.editors.asciidoc.config)
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to fetch AsciiDoc editor configuration.'
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  state.loading++
  try {
    // -> Only `config` is sent, so the editor's active state is left untouched by the merge
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        editors: {
          asciidoc: { config: state.config }
        }
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.editors.asciidoc.saveSuccess')
    })
    editorStore.$patch({ configIsLoaded: false })
    close()
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to save AsciiDoc editor config',
      caption: err.message
    })
  }
  state.loading--
}

onMounted(() => {
  load()
})
</script>
