<template>
  <w-card class="page-relation-dialog" style="width: 500px">
    <w-toolbar class="bg-primary text-white">
      <div class="text-subtitle2" v-if="isEditMode">{{ t('editor.pageRel.titleEdit') }}</div>
      <div class="text-subtitle2" v-else>{{ t('editor.pageRel.title') }}</div>
    </w-toolbar>
    <w-card-section>
      <!--
        `self-start` on every button: WForm stacks with `flex-col`, so a button left to its own devices
        stretches to the full width of the dialog. The section titles pull the item below them up, since
        the form's `gap-4` belongs between sections rather than between a title and its own content.
      -->
      <div class="text-overline -mb-3">{{ t('editor.pageRel.position') }}</div>
      <w-form class="gap-4 pt-4">
        <div>
          <w-btn-toggle
            v-model="state.pos"
            push
            glossy
            no-caps
            toggle-color="primary"
            :options="[
              { label: t('editor.pageRel.left'), value: 'left' },
              { label: t('editor.pageRel.center'), value: 'center' },
              { label: t('editor.pageRel.right'), value: 'right' }
            ]" />
        </div>
        <div class="text-overline -mb-3">{{ t('editor.pageRel.button') }}</div>
        <!-- One item, so the two fields are only ever as far apart as their own margins -->
        <div class="flex flex-col">
          <w-input
            ref="iptRelLabel"
            outlined
            dense
            :label="t(`editor.pageRel.label`)"
            v-model="state.label" />
          <w-input
            v-if="state.pos !== `center`"
            outlined
            dense
            :label="t(`editor.pageRel.caption`)"
            v-model="state.caption" />
        </div>
        <w-btn
          class="self-start rounded"
          :label="t(`editor.pageRel.selectIcon`)"
          color="primary"
          outline>
          <w-tooltip>{{ t('iconPicker.open') }}</w-tooltip>
          <w-menu content-class="shadow-7"><icon-picker-dialog v-model="state.icon" /></w-menu>
        </w-btn>
        <div class="text-overline -mb-3">{{ t('editor.pageRel.target') }}</div>
        <div class="flex flex-nowrap items-center gap-3">
          <w-btn
            class="flex-none rounded"
            :label="t(`editor.pageRel.selectPage`)"
            color="primary"
            outline
            @click="selectTarget" />
          <!-- -> The chosen target, spelled out: the button says what it does, not what it picked -->
          <div class="text-caption font-robotomono min-w-0 flex-1 truncate">
            {{ state.target || '—' }}
          </div>
        </div>
        <div class="text-overline -mb-3">{{ t('editor.pageRel.preview') }}</div>
        <w-btn
          v-if="state.pos === `left`"
          class="self-start"
          padding="sm md"
          outline
          no-caps
          color="primary">
          <w-icon :name="state.icon" />
          <div class="flex flex-col text-left pl-4">
            <div class="text-body2">
              <strong>{{ state.label }}</strong>
            </div>
            <div class="text-caption">{{ state.caption }}</div>
          </div>
        </w-btn>
        <w-btn class="w-full" v-else-if="state.pos === `center`" color="primary" flat no-caps>
          <w-icon class="mr-2" :name="state.icon" />
          <span>{{ state.label }}</span>
        </w-btn>
        <w-btn
          v-else-if="state.pos === `right`"
          class="self-start"
          padding="sm md"
          outline
          no-caps
          color="primary">
          <div class="flex flex-col text-left pr-4">
            <div class="text-body2">
              <strong>{{ state.label }}</strong>
            </div>
            <div class="text-caption">{{ state.caption }}</div>
          </div>
          <w-icon :name="state.icon" />
        </w-btn>
      </w-form>
    </w-card-section>
    <w-card-actions class="card-actions">
      <w-space />
      <w-btn
        class="acrylic-btn"
        icon="la:times"
        :label="t(`common.actions.discard`)"
        color="grey-7"
        padding="xs md"
        flat
        @click="$emit('close')" />
      <w-btn
        v-if="isEditMode"
        :disabled="!canSubmit"
        icon="la:check"
        :label="t(`common.actions.save`)"
        unelevated
        color="primary"
        padding="xs md"
        @click="saveAndClose" />
      <w-btn
        v-else
        :disabled="!canSubmit"
        icon="la:plus"
        :label="t(`common.actions.create`)"
        unelevated
        color="primary"
        padding="xs md"
        @click="createAndClose" />
    </w-card-actions>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { v4 as uuid } from 'uuid'
import { cloneDeep } from 'es-toolkit/object'

import { dialog } from '@/composables/dialog'

import IconPickerDialog from './IconPickerDialog.vue'
import LinkPickerDialog from './LinkPickerDialog.vue'

// PROPS

const props = defineProps({
  editId: {
    type: String,
    default: null
  }
})

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
  icon: 'la:arrow-left',
  target: ''
})

// REFS

const iptRelLabel = ref(null)

// COMPUTED

const canSubmit = computed(() => state.label.length > 0)
const isEditMode = computed(() => Boolean(props.editId))

// WATCHERS

watch(
  () => state.pos,
  (newValue) => {
    switch (newValue) {
      case 'left': {
        state.icon = 'la:arrow-left'
        break
      }
      case 'center': {
        state.icon = 'la:book'
        break
      }
      case 'right': {
        state.icon = 'la:arrow-right'
        break
      }
    }
  }
)

// METHODS

const emit = defineEmits(['close'])

/*
  The same picker the editor's Insert Link uses, opened on whatever this relation already points at.

  No new-tab option: a relation is stored as a target and nothing else — see the shape written in
  `create()` — so offering the choice would be offering to discard it.
*/
function selectTarget() {
  dialog({
    component: LinkPickerDialog,
    componentProps: {
      title: t('editor.pageRel.target'),
      okLabel: t('common.actions.select'),
      initialHref: state.target,
      newTabOption: false
    }
  }).onOk(({ href }) => {
    state.target = href
  })
}

function create() {
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

function persist() {
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

/*
  Named handlers: an inline `persist(); $emit('close')` is reformatted onto two lines by oxfmt, which
  is no longer a valid template expression.
*/
function saveAndClose() {
  persist()
  emit('close')
}

function createAndClose() {
  create()
  emit('close')
}

// MOUNTED

onMounted(() => {
  if (props.editId) {
    const rel = pageStore.relations.find((r) => r.id === props.editId)
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
