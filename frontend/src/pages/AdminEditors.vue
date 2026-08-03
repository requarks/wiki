<template>
  <w-page class="admin-flags">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-cashbook.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.editors.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.editors.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/editors`"
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
          @click="refresh">
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
    <div class="p-4 gap-4">
      <w-card>
        <w-list separator>
          <template v-for="editor of editors" :key="editor.id">
            <w-item v-if="flagsStore.experimental || !editor.isDisabled">
              <blueprint-icon :icon="editor.icon" />
              <w-item-section>
                <w-item-label>
                  <strong>{{ t(`admin.editors.` + editor.id + `Name`) }}</strong>
                </w-item-label>
                <w-item-label caption>
                  <span>{{ t(`admin.editors.` + editor.id + `Description`) }}</span>
                </w-item-label>
                <w-item-label caption v-if="editor.useRendering">
                  <em class="text-purple">{{ t('admin.editors.useRenderingPipeline') }}</em>
                </w-item-label>
              </w-item-section>
              <template v-if="editor.hasConfig">
                <w-item-section side>
                  <w-btn
                    icon="la:cog"
                    :label="t(`admin.editors.configuration`)"
                    :color="dark.isActive ? `blue-grey-3` : `blue-grey-8`"
                    outline
                    no-caps
                    padding="xs md"
                    @click="openConfig(editor.id)" />
                </w-item-section>
                <w-separator class="ml-4" vertical />
              </template>
              <w-item-section side>
                <w-toggle
                  class="pr-2"
                  v-model="state.config[editor.id]"
                  :label="t(`admin.sites.isActive`)"
                  :aria-label="t(`admin.sites.isActive`)"
                  :disabled="editor.isDisabled" />
              </w-item-section>
            </w-item>
          </template>
        </w-list>
      </w-card>
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
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const flagsStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.editors.title')
})

const state = reactive({
  loading: 0,
  config: {
    api: false,
    asciidoc: false,
    blog: false,
    channel: false,
    markdown: false,
    redirect: true,
    wysiwyg: false
  }
})
const editors = reactive([
  {
    id: 'api',
    icon: 'api',
    isDisabled: true,
    useRendering: false
  },
  {
    id: 'asciidoc',
    icon: 'asciidoc',
    isDisabled: true,
    hasConfig: true,
    useRendering: true
  },
  {
    id: 'blog',
    icon: 'typewriter-with-paper',
    isDisabled: true,
    useRendering: true
  },
  {
    id: 'channel',
    icon: 'chat',
    isDisabled: true,
    useRendering: false
  },
  {
    id: 'markdown',
    icon: 'markdown',
    hasConfig: true,
    useRendering: true
  },
  {
    id: 'redirect',
    icon: 'advance',
    isDisabled: true,
    useRendering: false
  },
  {
    id: 'wysiwyg',
    icon: 'google-presentation',
    isDisabled: true,
    useRendering: true
  }
])

// WATCHERS

watch(
  () => adminStore.currentSiteId,
  (newValue) => {
    loading.show()
    load()
  }
)

// METHODS

async function load() {
  state.loading++
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json()
    const data = resp?.editors
    state.config.asciidoc = data?.asciidoc?.isActive ?? false
    state.config.markdown = data?.markdown?.isActive ?? false
    state.config.wysiwyg = data?.wysiwyg?.isActive ?? false
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to fetch editors state.'
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  state.loading++
  try {
    // -> Only `isActive` is sent, so each editor's own `config` is left untouched by the merge
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        editors: {
          asciidoc: { isActive: state.config.asciidoc },
          markdown: { isActive: state.config.markdown },
          wysiwyg: { isActive: state.config.wysiwyg }
        }
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.editors.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    if (adminStore.currentSiteId === siteStore.id) {
      siteStore.$patch({
        editors: {
          asciidoc: state.config.asciidoc,
          markdown: state.config.markdown,
          wysiwyg: state.config.wysiwyg
        }
      })
    }
    notify({
      type: 'positive',
      message: t('admin.editors.saveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to save site editors config',
      caption: err.message
    })
  }
  state.loading--
}

async function refresh() {
  await load()
}

function openConfig(editorId) {
  switch (editorId) {
    case 'markdown': {
      adminStore.$patch({
        overlayOpts: {},
        overlay: 'EditorMarkdownConfig'
      })
      break
    }
    default: {
      notify({
        type: 'negative',
        message: 'Invalid Editor Config Call'
      })
    }
  }
}

// MOUNTED

onMounted(async () => {
  loading.show()
  if (adminStore.currentSiteId) {
    await load()
  }
})
</script>

<style lang="scss"></style>
