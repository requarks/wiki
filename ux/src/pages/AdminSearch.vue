<template lang='pug'>
q-page.admin-flags
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-find-and-replace.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.search.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.search.subtitle') }}
    .col-auto.flex
      q-btn.q-mr-sm.acrylic-btn(
        flat
        icon='mdi-database-refresh'
        :label='t(`admin.searchRebuildIndex`)'
        color='purple'
        @click='rebuild'
        :loading='state.rebuildLoading'
      )
      q-separator.q-mr-sm(vertical)
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/system/search`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='load'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='mdi-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :loading='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-7
      q-card.q-py-sm
        q-item(tag='label')
          blueprint-icon(icon='search')
          q-item-section
            q-item-label {{t(`admin.search.highlighting`)}}
            q-item-label(caption) {{t(`admin.search.highlightingHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.termHighlighting'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.search.highlighting`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon.self-start(icon='search')
          q-item-section
            q-item-label {{t(`admin.search.dictOverrides`)}}
            q-no-ssr(:placeholder='t(`common.loading`)')
              util-code-editor.admin-theme-cm.q-my-sm(
                v-model='state.config.dictOverrides'
                language='json'
                :min-height='250'
              )
              q-item-label(caption)
                i18n-t(keypath='admin.search.dictOverridesHint' tag='span')
                  span { "en": "english" }

    .col-12.col-lg-5.gt-md
      .q-pa-md.text-center
        img(src='/_assets/illustrations/undraw_file_searching.svg', style='width: 80%;')
</template>

<script setup>
import gql from 'graphql-tag'
import { onMounted, reactive, ref } from 'vue'
import { cloneDeep, omit } from 'lodash-es'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from '@/stores/site'
import { useFlagsStore } from '@/stores/flags'

import UtilCodeEditor from '@/components/UtilCodeEditor.vue'

// QUASAR

const $q = useQuasar()

// STORES

const flagsStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.flags.title')
})

// DATA

const state = reactive({
  loading: 0,
  rebuildLoading: false,
  config: {
    termHighlighting: false,
    dictOverrides: ''
  }
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getSearchConfig {
          systemSearch {
            termHighlighting
            dictOverrides
          }
        }
      `,
      fetchPolicy: 'network-only'
    })
    state.config = cloneDeep(resp?.data?.systemSearch)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to load search config',
      caption: err.message
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
        mutation saveSearchConfig (
          $termHighlighting: Boolean
          $dictOverrides: String
        ) {
          updateSystemSearch(
            termHighlighting: $termHighlighting
            dictOverrides: $dictOverrides
          ) {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `,
      variables: state.config
    })
    const resp = respRaw?.data?.updateSystemSearch?.operation || {}
    if (resp.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.search.saveSuccess')
      })
    } else {
      throw new Error(resp.message)
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save search config',
      caption: err.message
    })
  }
  state.loading--
}

async function rebuild () {
  state.rebuildLoading = true
  try {
    const respRaw = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation rebuildSearchIndex {
          rebuildSearchIndex {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `
    })
    const resp = respRaw?.data?.rebuildSearchIndex?.operation || {}
    if (resp.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.search.rebuildInitSuccess')
      })
    } else {
      throw new Error(resp.message)
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to initiate a search index rebuild',
      caption: err.message
    })
  }
  state.rebuildLoading = false
}

// MOUNTED

onMounted(async () => {
  load()
})

</script>

<style lang='scss'>

</style>
