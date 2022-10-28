<template lang="pug">
.q-gutter-xs
  template(v-if='pageStore.tags && pageStore.tags.length > 0')
    q-chip(
      square
      color='secondary'
      text-color='white'
      dense
      clickable
      :removable='props.edit'
      @remove='removeTag(tag)'
      v-for='tag of pageStore.tags'
      :key='`tag-` + tag'
      )
      q-icon.q-mr-xs(name='las la-tag', size='14px')
      span.text-caption {{tag}}
    q-chip(
      v-if='!props.edit && pageStore.tags.length > 1'
      square
      color='secondary'
      text-color='white'
      dense
      clickable
      )
      q-icon(name='las la-tags', size='14px')
  q-input.q-mt-md(
    v-if='props.edit'
    outlined
    v-model='state.newTag'
    dense
    placeholder='Add new tag...'
  )
</template>

<script setup>
import { useQuasar } from 'quasar'
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePageStore } from 'src/stores/page'

// PROPS

const props = defineProps({
  edit: {
    type: Boolean,
    default: false
  }
})

// QUASAR

const $q = useQuasar()

// STORES

const pageStore = usePageStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  newTag: ''
})

// METHODS

function removeTag (tag) {
  pageStore.tags = pageStore.tags.filter(t => t !== tag)
}
</script>
