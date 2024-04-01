<template lang="pug">
q-card(style='min-width: 350px')
  q-card-section.card-header
    q-icon(name='img:/_assets/icons/fluent-sidebar-menu.svg', left, size='sm')
    span {{t(`navEdit.title`)}}
  q-list(padding)
    template(v-if='isRoot')
      q-item(tag='label')
        q-item-section(side)
          q-radio(v-model='state.mode', val='inherit')
        q-item-section
          q-item-label Show
          q-item-label(caption) Show the left sidebar navigaiton menu items.
      q-item(tag='label')
        q-item-section(side)
          q-radio(v-model='state.mode', val='hide')
        q-item-section
          q-item-label Hide
          q-item-label(caption) Completely hide the left sidebar navigation.
    template(v-else)
      q-item(tag='label')
        q-item-section(side)
          q-radio(v-model='state.mode', val='inherit')
        q-item-section
          q-item-label Inherit
          q-item-label(caption) Use the menu items and settings from the parent path.
      q-item(tag='label')
        q-item-section(side)
          q-radio(v-model='state.mode', val='override')
        q-item-section
          q-item-label Override Current + Descendants
          q-item-label(caption) Set menu items and settings for this path and all descendants.
      q-item(tag='label')
        q-item-section(side)
          q-radio(v-model='state.mode', val='overrideExact')
        q-item-section
          q-item-label Override Current Only
          q-item-label(caption) Set menu items and settings only for this path.
      q-item(tag='label')
        q-item-section(side)
          q-radio(v-model='state.mode', val='hide')
        q-item-section
          q-item-label Hide Current + Descendants
          q-item-label(caption) Completely hide the left sidebar navigation for this path and all descendants.
      q-item(tag='label')
        q-item-section(side)
          q-radio(v-model='state.mode', val='hideExact')
        q-item-section
          q-item-label Hide Current Only
          q-item-label(caption) Completely hide the left sidebar navigation only for this path.

  template(v-if='canEditMenuItems')
    q-separator(inset)
    q-card-section
      q-btn.full-width(
        unelevated
        icon='mdi-playlist-edit'
        color='deep-orange-9'
        :label='t(`navEdit.editMenuItems`)'
        @click='startEditing'
      )

  q-card-actions.card-actions
    q-space
    q-btn.acrylic-btn(
      flat
      :label='t(`common.actions.cancel`)'
      color='grey'
      padding='xs md'
      @click='props.menuHideHandler'
      )
    q-btn(
      unelevated
      :label='t(`common.actions.save`)'
      color='positive'
      padding='xs md'
      @click='save'
      :loading='state.loading > 0'
      )
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import gql from 'graphql-tag'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  menuHideHandler: {
    type: Function,
    default: () => ({})
  },
  updatePositionHandler: {
    type: Function,
    default: () => ({})
  }
})

// QUASAR

const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  mode: 'inherit',
  loading: 0
})

// COMPUTED

const isRoot = computed(() => {
  return pageStore.path === '' || pageStore.path === 'home'
})

const canEditMenuItems = computed(() => {
  if (!isRoot.value && state.mode === 'inherit') { return false }
  return ['inherit', 'override', 'overrideExact'].includes(state.mode)
})

// WATCHERS

watch(() => state.mode, () => {
  nextTick(() => {
    props.updatePositionHandler()
  })
})

// METHODS

function startEditing () {
  siteStore.$patch({ overlay: 'NavEdit', overlayOpts: { mode: state.mode } })
  props.menuHideHandler()
}

async function save () {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation updateNavMode (
          $pageId: UUID!
          $mode: NavigationMode!
          ) {
          updateNavigation (
            pageId: $pageId
            mode: $mode
          ) {
            operation {
              succeeded
              message
            }
            navigationId
          }
        }
      `,
      variables: {
        pageId: pageStore.id,
        mode: state.mode
      }
    })
    if (resp?.data?.updateNavigation?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('navEdit.saveModeSuccess')
      })
      // -> Clear GraphQL Cache
      APOLLO_CLIENT.cache.evict('ROOT_QUERY')
      APOLLO_CLIENT.cache.gc()

      // -> Set current nav id
      pageStore.$patch({
        navigationMode: state.mode,
        navigationId: resp.data.updateNavigation.navigationId
      })

      props.menuHideHandler()
    } else {
      throw new Error(resp?.data?.updateNavigation?.operation?.message || 'Unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  state.mode = pageStore.navigationMode
})

</script>
