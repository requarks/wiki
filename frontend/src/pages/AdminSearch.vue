<template>
  <w-page class="admin-flags">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-find-and-replace-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.search.title') }}
        </div>
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
          :color="dark.isActive ? `indigo-4` : `indigo`"
          @click="rebuild"
          :loading="state.rebuildLoading" />
        <w-separator class="mr-2" vertical />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/search`"
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
        <w-card class="mt-4 py-2">
          <w-card-header>
            {{ t('admin.search.mappings') }}
            <template #hint>{{ t('admin.search.mappingsHint') }}</template>
          </w-card-header>
          <!-- -> A table rather than list items: one line per entry, with the columns lined up
                  down the card, keeps some thirty rows short enough to read at a glance -->
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left text-sm">
              <thead>
                <tr class="text-caption text-black/54 dark:text-white/70">
                  <th class="px-4 py-1 font-medium">{{ t('admin.search.mappingColCode') }}</th>
                  <th class="px-4 py-1 font-medium">{{ t('admin.search.mappingColLanguage') }}</th>
                  <th class="px-4 py-1 font-medium">
                    {{ t('admin.search.mappingColDictionary') }}
                  </th>
                  <th class="px-4 py-1 text-right font-medium">
                    {{ t('admin.search.mappingColSource') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="m of mappings"
                  :key="m.locale"
                  class="border-t border-black/12 dark:border-white/15">
                  <td class="px-4 py-1.5 font-mono text-xs text-black/54 dark:text-white/70">
                    {{ m.locale }}
                  </td>
                  <td class="px-4 py-1.5">{{ m.name }}</td>
                  <td class="px-4 py-1.5 font-mono whitespace-nowrap">
                    <!-- -> The built-in an override replaces, struck out ahead of what replaced it -->
                    <template v-if="m.source === 'override' && m.builtin">
                      <span class="line-through opacity-50">{{ m.builtin }}</span>
                      <w-icon
                        class="mx-1 align-middle opacity-50"
                        name="mdi:arrow-right"
                        size="14px" />
                    </template>
                    <span :class="m.installed ? '' : 'text-negative line-through'">
                      {{ m.dictionary }}
                    </span>
                    <!-- -> The icon draws as an aria-hidden <svg> with no slot, so the span carries
                            both the tooltip and what a screen reader says -->
                    <span
                      v-if="!m.installed"
                      class="ml-1 inline-flex align-middle"
                      data-tooltip-anchor
                      role="img"
                      tabindex="0"
                      :aria-label="notInstalledLabel">
                      <w-icon name="la:exclamation-triangle" color="negative" size="16px" />
                      <w-tooltip>{{ notInstalledLabel }}</w-tooltip>
                    </span>
                  </td>
                  <td class="px-4 py-1.5 text-right">
                    <w-badge
                      v-if="m.source === 'override'"
                      color="secondary"
                      :label="t('admin.search.mappingOverride')" />
                    <w-badge
                      v-else
                      color="grey-7"
                      outline
                      :label="t('admin.search.mappingBuiltin')" />
                  </td>
                </tr>
                <tr class="border-t border-black/12 dark:border-white/15">
                  <td class="px-4 py-1.5 font-mono text-xs text-black/54 dark:text-white/70">*</td>
                  <td class="px-4 py-1.5">
                    {{ t('admin.search.mappingFallback') }}
                    <span class="text-caption text-black/54 dark:text-white/70">
                      · {{ t('admin.search.mappingFallbackHint') }}
                    </span>
                  </td>
                  <td class="px-4 py-1.5 font-mono">{{ state.fallbackDictionary }}</td>
                  <td class="px-4 py-1.5 text-right">
                    <w-badge
                      color="grey-7"
                      outline
                      :label="t('admin.search.mappingFallbackSource')" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
import { computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useSiteStore } from '@/stores/site'

import UtilCodeEditor from '@/components/UtilCodeEditor.vue'
import { apiErrorMessage } from '@/helpers/apiError'

// COMPOSABLES

const dark = useDark()

// STORES

const siteStore = useSiteStore()

// I18N

const { t, locale } = useI18n()

// META

useMeta(() => ({
  title: t('admin.search.title')
}))

// DATA

const state = reactive({
  loading: 0,
  rebuildLoading: false,
  availableDictionaries: [],
  // -> As saved, worked out by the server: what the overrides editor holds takes effect on Apply
  mappings: [],
  fallbackDictionary: 'simple',
  config: {
    termHighlighting: false,
    // -> The editor works on text; the API stores and returns an object
    dictOverrides: '{}'
  }
})

// COMPUTED

/**
 * The mapping in force, overrides first since they are what the administrator wrote, each with the
 * language named in the interface's own language.
 */
const mappings = computed(() => {
  let names = null
  try {
    names = new Intl.DisplayNames([locale.value], { type: 'language', languageDisplay: 'standard' })
  } catch {
    // -> An interface locale Intl does not know; the codes alone still say everything
  }
  return state.mappings
    .map((m) => {
      let name = m.locale
      try {
        name = names?.of(m.locale) ?? m.locale
      } catch {
        // -> A malformed tag throws rather than returning nothing; show the code
      }
      return { ...m, name }
    })
    .sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === 'override' ? -1 : 1
      }
      return a.locale.localeCompare(b.locale)
    })
})

const notInstalledLabel = computed(() =>
  t('admin.search.mappingNotInstalled', { fallback: state.fallbackDictionary })
)

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
    state.mappings = resp?.mappings ?? []
    state.fallbackDictionary = resp?.fallbackDictionary ?? 'simple'
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
    notify({
      type: 'negative',
      message: t('admin.search.saveFailed'),
      caption: apiErrorMessage(err)
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
    notify({
      type: 'negative',
      message: t('admin.search.rebuildFailed'),
      caption: apiErrorMessage(err)
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
