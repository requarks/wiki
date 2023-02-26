<template lang='pug'>
q-page.admin-flags
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-cashbook.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.editors.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.editors.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/admin/editors`'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='refresh'
        )
      q-btn(
        unelevated
        icon='mdi-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .q-pa-md.q-gutter-md
    q-card.shadow-1
      q-list(separator)
        template(v-for='editor of editors', :key='editor.id')
          q-item(v-if='flagsStore.experimental || !editor.isDisabled')
            blueprint-icon(:icon='editor.icon')
            q-item-section
              q-item-label: strong {{t(`admin.editors.` + editor.id + `Name`)}}
              q-item-label(caption)
                span {{t(`admin.editors.` + editor.id + `Description`)}}
              q-item-label(caption, v-if='editor.useRendering')
                em.text-purple {{ t('admin.editors.useRenderingPipeline') }}
            template(v-if='editor.hasConfig')
              q-item-section(
                side
                )
                q-btn(
                  icon='las la-cog'
                  :label='t(`admin.editors.configuration`)'
                  :color='$q.dark.isActive ? `blue-grey-3` : `blue-grey-8`'
                  outline
                  no-caps
                  padding='xs md'
                  @click='openConfig(editor.id)'
                )
              q-separator.q-ml-md(vertical)
            q-item-section(side)
              q-toggle.q-pr-sm(
                v-model='state.config[editor.id]'
                :color='editor.isDisabled ? `grey` : `primary`'
                checked-icon='las la-check'
                unchecked-icon='las la-times'
                :label='t(`admin.sites.isActive`)'
                :aria-label='t(`admin.sites.isActive`)'
                :disabled='editor.isDisabled'
                )
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { defineAsyncComponent, onMounted, reactive, watch } from 'vue'
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'

import { useAdminStore } from 'src/stores/admin'
import { useFlagsStore } from 'src/stores/flags'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

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
    useRendering: true
  }
])

// WATCHERS

watch(() => adminStore.currentSiteId, (newValue) => {
  $q.loading.show()
  load()
})

// METHODS

async function load () {
  state.loading++
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
            asciidoc {
              isActive
            }
            markdown {
              isActive
            }
            wysiwyg  {
              isActive
            }
          }
        }
      }`,
      variables: {
        siteId: adminStore.currentSiteId
      },
      fetchPolicy: 'network-only'
    })
    const data = cloneDeep(resp?.data?.siteById?.editors)
    state.config.asciidoc = data?.asciidoc?.isActive ?? false
    state.config.markdown = data?.markdown?.isActive ?? false
    state.config.wysiwyg = data?.wysiwyg?.isActive ?? false
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to fetch editors state.'
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
            asciidoc: { isActive: state.config.asciidoc },
            markdown: { isActive: state.config.markdown },
            wysiwyg: { isActive: state.config.wysiwyg }
          }
        }
      }
    })
    if (respRaw?.data?.updateSite?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.editors.saveSuccess')
      })
    } else {
      throw new Error(respRaw?.data?.updateSite?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save site editors config',
      caption: err.message
    })
  }
  state.loading--
}

async function refresh () {
  await load()
}

function openConfig (editorId) {
  switch (editorId) {
    case 'markdown': {
      adminStore.$patch({
        overlayOpts: { },
        overlay: 'EditorMarkdownConfig'
      })
      break
    }
    default: {
      $q.notify({
        type: 'negative',
        message: 'Invalid Editor Config Call'
      })
    }
  }
}

// MOUNTED

onMounted(async () => {
  $q.loading.show()
  if (adminStore.currentSiteId) {
    await load()
  }
})
</script>

<style lang='scss'>

</style>
