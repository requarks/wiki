<template lang="pug">
q-card.page-relation-dialog(style='width: 500px;')
  q-toolbar.bg-primary.text-white
    .text-subtitle2(v-if='isEditMode') {{t('editor.pageRel.titleEdit')}}
    .text-subtitle2(v-else) {{t('editor.pageRel.title')}}
  q-card-section
    .text-overline {{t('editor.pageRel.position')}}
    q-form.q-gutter-md.q-pt-md
      div
        q-btn-toggle(
          v-model='state.pos'
          push
          glossy
          no-caps
          toggle-color='primary'
          :options=`[
            { label: t('editor.pageRel.left'), value: 'left' },
            { label: t('editor.pageRel.center'), value: 'center' },
            { label: t('editor.pageRel.right'), value: 'right' }
          ]`
        )
      .text-overline {{t('editor.pageRel.button')}}
      q-input(
        ref='iptRelLabel'
        outlined
        dense
        :label='t(`editor.pageRel.label`)'
        v-model='state.label'
        )
      template(v-if='state.pos !== `center`')
        q-input(
          outlined
          dense
          :label='t(`editor.pageRel.caption`)'
          v-model='state.caption'
          )
      q-btn.rounded-borders(
        :label='t(`editor.pageRel.selectIcon`)'
        color='primary'
        outline
        )
        q-menu(content-class='shadow-7')
          icon-picker-dialog(v-model='state.icon')
      .text-overline {{t('editor.pageRel.target')}}
      q-btn.rounded-borders(
        :label='t(`editor.pageRel.selectPage`)'
        color='primary'
        outline
        )
      .text-overline {{t('editor.pageRel.preview')}}
      q-btn(
        v-if='state.pos === `left`'
        padding='sm md'
        outline
        :icon='state.icon'
        no-caps
        color='primary'
        )
        .column.text-left.q-pl-md
          .text-body2: strong {{state.label}}
          .text-caption {{state.caption}}
      q-btn.full-width(
        v-else-if='state.pos === `center`'
        :label='state.label'
        color='primary'
        flat
        no-caps
        :icon='state.icon'
      )
      q-btn(
        v-else-if='state.pos === `right`'
        padding='sm md'
        outline
        :icon-right='state.icon'
        no-caps
        color='primary'
        )
        .column.text-left.q-pr-md
          .text-body2: strong {{state.label}}
          .text-caption {{state.caption}}
  q-card-actions.card-actions
    q-space
    q-btn.acrylic-btn(
      icon='las la-times'
      :label='t(`common.actions.discard`)'
      color='grey-7'
      padding='xs md'
      v-close-popup
      flat
    )
    q-btn(
      v-if='isEditMode'
      :disabled='!canSubmit'
      icon='las la-check'
      :label='t(`common.actions.save`)'
      unelevated
      color='primary'
      padding='xs md'
      @click='persist'
      v-close-popup
    )
    q-btn(
      v-else
      :disabled='!canSubmit'
      icon='las la-plus'
      :label='t(`common.actions.create`)'
      unelevated
      color='primary'
      padding='xs md'
      @click='create'
      v-close-popup
    )
</template>

<script setup>
import { v4 as uuid } from 'uuid'
import { cloneDeep, find } from 'lodash-es'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import IconPickerDialog from './IconPickerDialog.vue'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  editId: {
    type: String,
    default: null
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
  pos: 'left',
  label: '',
  caption: '',
  icon: 'las la-arrow-left',
  target: ''
})

// REFS

const iptRelLabel = ref(null)

// COMPUTED

const canSubmit = computed(() => state.label.length > 0)
const isEditMode = computed(() => Boolean(props.editId))

// WATCHERS

watch(() => state.pos, (newValue) => {
  switch (newValue) {
    case 'left': {
      state.icon = 'las la-arrow-left'
      break
    }
    case 'center': {
      state.icon = 'las la-book'
      break
    }
    case 'right': {
      state.icon = 'las la-arrow-right'
      break
    }
  }
})

// METHODS

function create () {
  pageStore.$patch({
    relations: [
      ...pageStore.relations,
      {
        id: uuid(),
        position: state.pos,
        label: state.label,
        ...(state.pos !== 'center' ? { caption: state.caption } : {}),
        icon: state.icon,
        target: state.target
      }
    ]
  })
}

function persist () {
  const rels = cloneDeep(pageStore.relations)
  for (const rel of rels) {
    if (rel.id === props.editId) {
      rel.position = state.pos
      rel.label = state.label
      rel.caption = state.caption
      rel.icon = state.icon
      rel.target = state.target
    }
  }
  pageStore.$patch({
    relations: rels
  })
}

// MOUNTED

onMounted(() => {
  if (props.editId) {
    const rel = find(pageStore.relations, ['id', props.editId])
    if (rel) {
      state.pos = rel.position
      state.label = rel.label
      state.caption = rel.caption || ''
      state.icon = rel.icon
      state.target = rel.target
    }
  }
  nextTick(() => {
    iptRelLabel.value.focus()
  })
})
</script>
