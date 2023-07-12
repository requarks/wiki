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
      q-icon.q-mr-xs(name='las la-hashtag', size='14px')
      span.text-caption {{tag}}
  q-select.q-mt-md(
    v-if='props.edit'
    outlined
    v-model='pageStore.tags'
    :options='state.filteredTags'
    dense
    options-dense
    use-input
    use-chips
    multiple
    hide-selected
    hide-dropdown-icon
    :input-debounce='0'
    new-value-mode='add-unique'
    @new-value='createTag'
    @filter='filterTags'
    placeholder='Select or create tags...'
    :loading='state.loading'
    )
    template(v-slot:option='scope')
      q-item(v-bind='scope.itemProps')
        q-item-section(side)
          q-checkbox(:model-value='scope.selected', @update:model-value='scope.toggleOption(scope.opt)', size='sm')
        q-item-section
          q-item-label(v-html='scope.opt')
</template>

<script setup>
import { useQuasar } from 'quasar'
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'

import { useEditorStore } from 'src/stores/editor'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

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

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  tags: [],
  filteredTags: [],
  loading: false
})

// WATCHERS

pageStore.$subscribe(() => {
  if (props.edit) {
    editorStore.$patch({
      lastChangeTimestamp: DateTime.utc()
    })
  }
})

watch(() => props.edit, async (newValue) => {
  if (newValue) {
    state.loading = true
    await siteStore.fetchTags()
    state.tags = siteStore.tags.map(t => t.tag)
    state.loading = false
  }
}, { immediate: true })

// METHODS

function filterTags (val, update) {
  update(() => {
    if (val === '') {
      state.filteredTags = state.tags
    } else {
      const tagSearch = val.toLowerCase()
      state.filteredTags = state.tags.filter(
        v => v.toLowerCase().indexOf(tagSearch) >= 0
      )
    }
  })
}

function createTag (val, done) {
  if (val) {
    const currentTags = pageStore.tags.slice()
    for (const tag of val.split(/[,;]+/).map(v => v.trim()).filter(v => v)) {
      if (!state.tags.includes(tag)) {
        state.tags.push(tag)
      }
      if (!currentTags.includes(tag)) {
        currentTags.push(tag)
      }
    }
    done('')
    pageStore.tags = currentTags
  }
}

function removeTag (tag) {
  pageStore.tags = pageStore.tags.filter(t => t !== tag)
}
</script>
