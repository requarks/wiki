<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/ultraviolet-markdown.svg', left, size='md')
    span {{t('editor.settings.markdown')}}
    q-space
    q-btn.q-mr-sm(
      flat
      rounded
      color='white'
      :aria-label='t(`common.actions.refresh`)'
      icon='las la-question-circle'
      :href='siteStore.docsBase + `/editor/markdown`'
      target='_blank'
      type='a'
    )
    q-btn-group(push)
      q-btn(
        push
        color='grey-6'
        text-color='white'
        :aria-label='t(`common.actions.refresh`)'
        icon='las la-redo-alt'
        @click='load'
        :loading='state.loading > 0'
        )
        q-tooltip(anchor='center left', self='center right') {{t(`common.actions.refresh`)}}
      q-btn(
        push
        color='white'
        text-color='grey-7'
        :label='t(`common.actions.cancel`)'
        :aria-label='t(`common.actions.cancel`)'
        icon='las la-times'
        @click='close'
      )
      q-btn(
        push
        color='positive'
        text-color='white'
        :label='t(`common.actions.apply`)'
        :aria-label='t(`common.actions.apply`)'
        icon='las la-check'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-page-container
    q-page.q-pa-md(style='max-width: 1200px; margin: 0 auto;')
      q-card.shadow-1.q-py-sm
        q-item(tag='label')
          blueprint-icon(icon='enter-key')
          q-item-section
            q-item-label {{t(`editor.settings.markdownPreviewShown`)}}
            q-item-label(caption) {{t(`editor.settings.markdownPreviewShownHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.previewShown'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`editor.settings.markdownPreviewShown`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='width')
          q-item-section
            q-item-label {{t(`editor.settings.markdownFontSize`)}}
            q-item-label(caption) {{t(`editor.settings.markdownFontSizeHint`)}}
          q-item-section(side)
            q-input(
              type='number'
              min='10'
              max='32'
              style='width: 100px;'
              outlined
              v-model='state.config.fontSize'
              dense
              :aria-label='t(`editor.settings.markdownFontSize`)'
              )

      q-inner-loading(:showing='state.loading > 0')
        q-spinner(color='accent', size='lg')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { onMounted, reactive } from 'vue'
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'

import { useEditorStore } from 'src/stores/editor'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

// QUASAR

const $q = useQuasar()

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

function close () {
  siteStore.$patch({ overlay: '' })
}

async function load () {
  state.loading++
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query loadEditorUserSettings {
          userEditorSettings (editor: "markdown")
        }
      `,
      fetchPolicy: 'network-only'
    })
    const respConf = cloneDeep(resp?.data?.userEditorSettings)
    state.config.previewShown = respConf.previewShown ?? true
    state.config.fontSize = respConf.fontSize ?? 16
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to fetch Markdown editor settings.'
    })
  }
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading++
  try {
    const respRaw = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveEditorUserSettings (
          $config: JSON!
          ) {
          saveUserEditorSettings (
            editor: "markdown"
            config: $config
            ) {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `,
      variables: {
        config: state.config
      }
    })
    if (respRaw?.data?.saveUserEditorSettings?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.editors.markdown.saveSuccess')
      })
      close()
    } else {
      throw new Error(respRaw?.data?.saveUserEditorSettings?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save Markdown editor settings.',
      caption: err.message
    })
  }
  state.loading--
}

onMounted(() => {
  load()
})
</script>
