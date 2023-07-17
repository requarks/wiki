<template lang="pug">
q-card(style='min-width: 350px')
  q-card-section.card-header
    q-icon(name='img:/_assets/icons/fluent-sidebar-menu.svg', left, size='sm')
    span {{t(`navEdit.title`)}}
  q-card-section
    q-btn.full-width(
      unelevated
      icon='mdi-playlist-edit'
      color='deep-orange-9'
      :label='t(`navEdit.editMenuItems`)'
      @click='startEditing'
    )
  q-separator(inset)
  q-card-section.q-pb-none.text-body2 Mode
  q-list(padding)
    q-item(tag='label')
      q-item-section(side)
        q-radio(v-model='state.mode', val='inherit', :disable='isRoot')
      q-item-section
        q-item-label Inherit
        q-item-label(caption) Use the menu items and settings from the parent path.
    q-item(tag='label')
      q-item-section(side)
        q-radio(v-model='state.mode', val='starting', :disable='isRoot')
      q-item-section
        q-item-label Override Current + Descendants
        q-item-label(caption) Set menu items and settings for this path and all children.
    q-item(tag='label')
      q-item-section(side)
        q-radio(v-model='state.mode', val='exact', :disable='isRoot')
      q-item-section
        q-item-label Override Current Only
        q-item-label(caption) Set menu items and settings only for this path.
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
      )
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// PROPS

const props = defineProps({
  menuHideHandler: {
    type: Function,
    default: () => ({})
  }
})

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  mode: 'inherit'
})

// METHODS

function startEditing () {
  siteStore.$patch({ overlay: 'NavEdit' })
  props.menuHideHandler()
}

</script>
