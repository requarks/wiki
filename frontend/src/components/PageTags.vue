<template lang="pug">
.q-gutter-xs
  template(v-if='pageStore.tags && pageStore.tags.length > 0')
    q-chip(
      square
      color='secondary'
      text-color='white'
      dense
      :clickable='!props.edit'
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
    :placeholder='t(`editor.props.tagsPlaceholder`)'
    :aria-label='t(`editor.props.tags`)'
    :loading='state.loading'
    )
    template(v-slot:option='scope')
      q-item(v-bind='scope.itemProps')
        q-item-section(side)
          q-checkbox(:model-value='scope.selected', @update:model-value='scope.toggleOption(scope.opt)', size='sm')
        q-item-section
          q-item-label
            span(v-html='scope.opt')
</template>

<script setup>
import { useQuasar } from 'quasar'
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

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
      lastChangeTimestamp: Temporal.Now.instant()
    })
  }
})

watch(() => props.edit, async (newValue) => {
  if (!newValue) { return }
  state.loading = true
  try {
    await siteStore.fetchTags()
    state.tags = siteStore.tags.map(t => t.tag)
  } catch (err) {
    // -> Suggestions are a convenience: without them the field still adds tags, so this is a warning
    //    rather than a failure, and the spinner must not be left running either way
    $q.notify({
      type: 'warning',
      message: t('editor.props.tagsFailed'),
      caption: await err.response?.json().then(b => b?.message).catch(() => null) || err.message
    })
  } finally {
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
