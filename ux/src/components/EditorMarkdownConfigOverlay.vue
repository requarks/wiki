<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/ultraviolet-markdown.svg', left, size='md')
    span {{t(`admin.editors.markdownName`)}}
    q-space
    q-btn.q-mr-sm(
      flat
      rounded
      color='white'
      :aria-label='t(`common.actions.refresh`)'
      icon='las la-question-circle'
      :href='siteStore.docsBase + `/admin/editors/markdown`'
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
        :label='t(`common.actions.save`)'
        :aria-label='t(`common.actions.save`)'
        icon='las la-check'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-page-container
    q-page.q-pa-md(style='max-width: 1200px; margin: 0 auto;')
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.editors.markdown.general')}}
        q-item(tag='label')
          blueprint-icon(icon='html')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.allowHTML`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.allowHTMLHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.allowHTML'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.editors.markdown.allowHTML`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='link')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.linkify`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.linkifyHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.linkify'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.editors.markdown.linkify`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='enter-key')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.lineBreaks`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.lineBreaksHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.lineBreaks'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.editors.markdown.lineBreaks`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='width')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.tabWidth`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.tabWidthHint`)}}
          q-item-section(side)
            q-input(
              type='number'
              min='1'
              max='8'
              style='width: 100px;'
              outlined
              v-model='state.config.tabWidth'
              dense
              :aria-label='t(`admin.editors.markdown.tabWidth`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='sigma')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.latexEngine`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.latexEngineHint`)}}
          q-item-section.col-auto
            q-btn-toggle(
              v-model='state.config.latexEngine'
              push
              glossy
              no-caps
              toggle-color='primary'
              :options='latexEngines'
            )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='data-sheet')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.multimdTable`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.multimdTableHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.multimdTable'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.editors.markdown.multimdTable`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='asterisk')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.typographer`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.typographerHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.typographer'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.editors.markdown.typographer`)'
              )
        template(v-if='state.config.typographer')
          q-separator.q-my-sm(inset)
          q-item(tag='label')
            blueprint-icon(icon='quote-left')
            q-item-section
              q-item-label {{t(`admin.editors.markdown.quotes`)}}
              q-item-label(caption) {{t(`admin.editors.markdown.quotesHint`)}}
            q-item-section(avatar)
              q-select(
                style='width: 200px;'
                outlined
                v-model='state.config.quotes'
                :options='quoteStyles'
                emit-value
                map-options
                dense
                options-dense
                :aria-label='t(`admin.editors.markdown.quotes`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='underline')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.underline`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.underlineHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.underline'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.editors.markdown.underline`)'
              )

      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.editors.markdown.plantuml')}}
        q-item(tag='label')
          blueprint-icon(icon='workflow')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.plantuml`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.plantumlHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.plantuml'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.editors.markdown.plantuml`)'
              )
        template(v-if='state.config.plantuml')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='website')
            q-item-section
              q-item-label {{t(`admin.editors.markdown.plantumlServerUrl`)}}
              q-item-label(caption) {{t(`admin.editors.markdown.plantumlServerUrlHint`)}}
            q-item-section(side)
              q-input(
                style='width: 450px;'
                outlined
                v-model='state.config.plantumlServerUrl'
                dense
                :aria-label='t(`admin.editors.markdown.plantumlServerUrl`)'
                )

      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.editors.markdown.kroki')}}
        q-item(tag='label')
          blueprint-icon(icon='workflow')
          q-item-section
            q-item-label {{t(`admin.editors.markdown.kroki`)}}
            q-item-label(caption) {{t(`admin.editors.markdown.krokiHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.kroki'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.editors.markdown.kroki`)'
              )
        template(v-if='state.config.kroki')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='website')
            q-item-section
              q-item-label {{t(`admin.editors.markdown.krokiServerUrl`)}}
              q-item-label(caption) {{t(`admin.editors.markdown.krokiServerUrlHint`)}}
            q-item-section(side)
              q-input(
                style='width: 450px;'
                outlined
                v-model='state.config.krokiServerUrl'
                dense
                :aria-label='t(`admin.editors.markdown.krokiServerUrl`)'
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

import { useAdminStore } from 'src/stores/admin'
import { useEditorStore } from 'src/stores/editor'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const editorStore = useEditorStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  config: {
    allowHTML: false,
    linkify: false,
    lineBreaks: false,
    typographer: false,
    quotes: 'english',
    underline: false,
    tabWidth: 2,
    latexEngine: 'katex',
    multimdTable: false,
    plantuml: false,
    plantumlServerUrl: 'https://',
    kroki: false,
    krokiServerUrl: 'https://'
  },
  loading: 0
})

const latexEngines = [
  { value: 'katex', label: 'KaTeX' },
  { value: 'mathjax', label: 'Mathjax' }
]

const quoteStyles = [
  { value: 'chinese', label: 'Chinese' },
  { value: 'english', label: 'English' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'greek', label: 'Greek' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'hungarian', label: 'Hungarian' },
  { value: 'polish', label: 'Polish' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'russian', label: 'Russian' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'swedish', label: 'Swedish' }
]

// METHODS

function close () {
  adminStore.$patch({ overlay: '' })
}

async function load () {
  state.loading++
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getEditorsState (
          $siteId: UUID!
        ) {
        siteById (
          id: $siteId
        ) {
          id
          editors {
            markdown {
              config
            }
          }
        }
      }`,
      variables: {
        siteId: adminStore.currentSiteId
      },
      fetchPolicy: 'network-only'
    })
    state.config = cloneDeep(resp?.data?.siteById?.editors?.markdown?.config)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to fetch markdown editor configuration.'
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
        mutation saveEditorState (
          $id: UUID!
          $patch: SiteUpdateInput!
          ) {
          updateSite (
            id: $id,
            patch: $patch
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
        id: adminStore.currentSiteId,
        patch: {
          editors: {
            markdown: { config: state.config }
          }
        }
      }
    })
    if (respRaw?.data?.updateSite?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.editors.markdown.saveSuccess')
      })
      editorStore.$patch({ configIsLoaded: false })
      close()
    } else {
      throw new Error(respRaw?.data?.updateSite?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save Markdown editor config',
      caption: err.message
    })
  }
  state.loading--
}

onMounted(() => {
  load()
})
</script>
