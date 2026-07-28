<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/ultraviolet-markdown.svg" left size="md" />
      <span>{{t('editor.settings.markdown')}}</span>
      <w-space />
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.refresh`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/editor/markdown`"
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
          <w-tooltip anchor="center left" self="center right">{{t(`common.actions.refresh`)}}</w-tooltip>
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
          :label="t(`common.actions.apply`)"
          :aria-label="t(`common.actions.apply`)"
          icon="la:check"
          @click="save"
          :disabled="state.loading > 0" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <w-page class="p-4" style="max-width: 1200px; margin: 0 auto;">
        <w-card class="shadow-1 py-2">
          <w-item tag="label">
            <blueprint-icon icon="enter-key" />
            <w-item-section>
              <w-item-label>{{t(`editor.settings.markdownPreviewShown`)}}</w-item-label>
              <w-item-label caption>{{t(`editor.settings.markdownPreviewShownHint`)}}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.previewShown"
                color="primary"
                checked-icon="la:check"
                unchecked-icon="la:times"
                :aria-label="t(`editor.settings.markdownPreviewShown`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="width" />
            <w-item-section>
              <w-item-label>{{t(`editor.settings.markdownFontSize`)}}</w-item-label>
              <w-item-label caption>{{t(`editor.settings.markdownFontSizeHint`)}}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-input
                type="number"
                min="10"
                max="32"
                style="width: 100px;"
                outlined
                v-model="state.config.fontSize"
                dense
                :aria-label="t(`editor.settings.markdownFontSize`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <w-inner-loading :showing="state.loading > 0">
          <w-spinner color="accent" size="lg" />
        </w-inner-loading>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive } from 'vue'

import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'

import { useEditorStore } from '@/stores/editor'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

// STORES

const editorStore = useEditorStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  config: {
    previewShown: false,
    fontSize: 16
  },
  loading: 0
})

// METHODS

function close() {
  siteStore.$patch({ overlay: '' })
}

async function load() {
  state.loading++
  loading.show()
  try {
    // -> An empty object is the correct answer for a user who has never saved any settings, so the
    //    defaults live here rather than being treated as a failure
    const conf = (await API_CLIENT.get('users/profile/editor-settings/markdown').json()) ?? {}
    state.config.previewShown = conf.previewShown ?? true
    state.config.fontSize = conf.fontSize ?? 16
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to fetch Markdown editor settings.',
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  state.loading++
  try {
    const resp = await API_CLIENT.put('users/profile/editor-settings/markdown', {
      json: {
        previewShown: state.config.previewShown,
        // -> A number input hands back a string; the editor reads this as a pixel size
        fontSize: Number.parseInt(state.config.fontSize, 10)
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.editors.markdown.saveSuccess')
    })
    close()
  } catch (err) {
    // -> ky throws above 400, with the reason in the body
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: 'Failed to save Markdown editor settings.',
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

onMounted(() => {
  load()
})
</script>
