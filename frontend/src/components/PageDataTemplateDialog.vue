<template>
  <w-card class="page-datatmpl-dialog" style="width: 1100px; max-width: 1100px;">
    <w-toolbar class="bg-primary text-white">
      <div class="text-subtitle2">{{t('editor.pageData.manageTemplates')}}</div>
      <w-space />
      <w-btn icon="la:times" dense flat @click="$emit('close')" />
    </w-toolbar>
    <w-card-section class="page-datatmpl-selector">
      <div class="flex gap-4">
        <w-select
          class="min-w-0 flex-1"
          v-model="state.selectedTemplateId"
          :options="siteStore.pageDataTemplates"
          standout
          :label="t(`editor.pageData.template`)"
          dense
          dark
          option-value="id"
          map-options
          emit-value />
        <w-btn
          icon="la:plus"
          :label="t(`common.actions.new`)"
          unelevated
          color="primary"
          no-caps
          @click="create" />
      </div>
    </w-card-section>
    <div class="flex flex-wrap" v-if="state.tmpl">
      <div class="flex-none page-datatmpl-sd">
        <div class="p-4">
          <w-btn
            class="acrylic-btn w-full"
            :label="t(`common.actions.howItWorks`)"
            icon="la:question-circle"
            flat
            color="pink"
            no-caps />
        </div>
        <w-item-label header style="margin-top: 2px;">{{t('editor.pageData.templateFullRowTypes')}}</w-item-label>
        <div class="px-4">
          <draggable
            class="q-list rounded"
            :list="inventoryMisc"
            :group="{name: `shared`, pull: `clone`, put: false}"
            :clone="cloneFieldType"
            :sort="false"
            :animation="150"
            @start="state.dragStarted = true"
            @end="state.dragStarted = false"
            item-key="id">
            <template #item="{element}">
              <w-item clickable>
                <w-item-section side>
                  <w-icon :name="element.icon" color="primary" />
                </w-item-section>
                <w-item-section><w-item-label>{{element.label}}</w-item-label></w-item-section>
              </w-item>
            </template>
          </draggable>
        </div>
        <w-item-label header>{{t('editor.pageData.templateKeyValueTypes')}}</w-item-label>
        <div class="px-4 pb-4">
          <draggable
            class="q-list rounded"
            :list="inventoryKV"
            :group="{name: `shared`, pull: `clone`, put: false}"
            :clone="cloneFieldType"
            :sort="false"
            :animation="150"
            @start="state.dragStarted = true"
            @end="state.dragStarted = false"
            item-key="id">
            <template #item="{element}">
              <w-item clickable>
                <w-item-section side>
                  <w-icon :name="element.icon" color="primary" />
                </w-item-section>
                <w-item-section><w-item-label>{{element.label}}</w-item-label></w-item-section>
              </w-item>
            </template>
          </draggable>
        </div>
      </div>
      <div class="min-w-0 flex-1 page-datatmpl-content">
        <w-scroll-area
          ref="scrollArea"
          :thumb-style="siteStore.thumbStyle"
          :bar-style="siteStore.barStyle"
          style="height: 100%;">
          <div class="min-w-0 flex-1 page-datatmpl-meta px-4 py-4 flex gap-4">
            <w-input
              class="min-w-0 flex-1"
              ref="tmplTitleIpt"
              :label="t(`editor.pageData.templateTitle`)"
              outlined
              dense
              v-model="state.tmpl.label" />
            <w-btn
              class="acrylic-btn"
              icon="la:check"
              :label="t(`common.actions.commit`)"
              no-caps
              flat
              color="positive"
              @click="commit" />
            <w-btn
              class="acrylic-btn"
              icon="la:trash"
              :aria-label="t(`common.actions.delete`)"
              flat
              color="negative"
              @click="remove" />
          </div>
          <w-item-label header>{{t('editor.pageData.templateStructure')}}</w-item-label>
          <div class="px-4 pb-4">
            <div
              :class="(state.dragStarted || state.tmpl.data.length < 1 ? `page-datatmpl-box` : ``)">
              <div
                class="text-caption text-primary p-4"
                v-if="state.tmpl.data.length < 1 && !state.dragStarted">
                <em>{{t('editor.pageData.dragDropHint')}}</em>
              </div>
              <draggable
                class="q-list rounded"
                :list="state.tmpl.data"
                group="shared"
                :animation="150"
                handle=".handle"
                @end="state.dragStarted = false"
                item-key="id">
                <template #item="{element}">
                  <w-item>
                    <w-item-section side>
                      <w-icon class="handle" name="la:bars" />
                    </w-item-section>
                    <w-item-section side>
                      <w-icon :name="element.icon" color="primary" />
                    </w-item-section>
                    <w-item-section>
                      <w-input
                        :label="t(`editor.pageData.label`)"
                        v-model="element.label"
                        outlined
                        dense />
                    </w-item-section>
                    <w-item-section v-if="element.type !== `header`">
                      <w-input
                        :label="t(`editor.pageData.uniqueKey`)"
                        v-model="element.key"
                        outlined
                        dense />
                    </w-item-section>
                    <w-item-section side>
                      <w-btn
                        class="acrylic-btn"
                        color="negative"
                        :aria-label="t(`common.actions.delete`)"
                        padding="xs"
                        icon="la:times"
                        flat
                        @click="removeItem(item)" />
                    </w-item-section>
                  </w-item>
                </template>
              </draggable>
            </div>
          </div>
          <div class="page-datatmpl-scrollend" ref="scrollAreaEnd" />
        </w-scroll-area>
      </div>
    </div>
    <div class="p-4 text-center" v-else-if="siteStore.pageDataTemplates.length > 0">
      <em class="text-grey-6">{{t('editor.pageData.selectTemplateAbove')}}</em>
    </div>
    <div class="p-4 text-center" v-else>
      <em class="text-grey-6">{{t('editor.pageData.noTemplate')}}</em>
    </div>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'

import { confirm } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { v4 as uuid } from 'uuid'
import { sortBy } from 'es-toolkit/array'
import { cloneDeep } from 'es-toolkit/object'
import draggable from 'vuedraggable'

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

defineEmits(['close'])

const { t } = useI18n()

// DATA

const state = reactive({
  selectedTemplateId: null,
  dragStarted: false,
  tmpl: null
})

const inventoryMisc = [
  {
    key: 'header',
    label: t('editor.pageData.fieldTypeHeader'),
    icon: 'la:heading'
  },
  {
    key: 'image',
    label: t('editor.pageData.fieldTypeImage'),
    icon: 'la:image'
  }
]

const inventoryKV = [
  {
    key: 'text',
    label: t('editor.pageData.fieldTypeText'),
    icon: 'la:font'
  },
  {
    key: 'number',
    label: t('editor.pageData.fieldTypeNumber'),
    icon: 'la:infinity'
  },
  {
    key: 'boolean',
    label: t('editor.pageData.fieldTypeBoolean'),
    icon: 'la:check-square'
  },
  {
    key: 'link',
    label: t('editor.pageData.fieldTypeLink'),
    icon: 'la:link'
  }
]

// REFS

const scrollAreaEnd = ref(null)
const tmplTitleIpt = ref(null)

// WATCHERS

watch(
  () => state.dragStarted,
  (newValue) => {
    if (newValue) {
      nextTick(() => {
        scrollAreaEnd.value.scrollIntoView({
          behavior: 'smooth'
        })
      })
    }
  }
)

watch(
  () => state.selectedTemplateId,
  (newValue) => {
    state.tmpl = cloneDeep(
      siteStore.pageDataTemplates.find((t) => t.id === state.selectedTemplateId)
    )
  }
)

// METHODS

function cloneFieldType(tp) {
  return {
    id: uuid(),
    type: tp.key,
    label: '',
    ...(tp.key !== 'header' ? { key: '' } : {}),
    icon: tp.icon
  }
}

function removeItem(item) {
  state.tmpl.data = state.tmpl.data.filter((i) => i.id !== item.id)
}

function create() {
  state.tmpl = {
    id: uuid(),
    label: t('editor.pageData.templateUntitled'),
    data: []
  }
  nextTick(() => {
    tmplTitleIpt.value.focus()
    nextTick(() => {
      document.execCommand('selectall')
    })
  })
}

function commit() {
  try {
    if (state.tmpl.label.length < 1) {
      throw new Error(t('editor.pageData.invalidTemplateName'))
    } else if (state.tmpl.data.length < 1) {
      throw new Error(t('editor.pageData.emptyTemplateStructure'))
    } else if (state.tmpl.data.some((f) => f.label.length < 1)) {
      throw new Error(t('editor.pageData.invalidTemplateLabels'))
    } else if (state.tmpl.data.some((f) => f.type !== 'header' && f.key.length < 1)) {
      throw new Error(t('editor.pageData.invalidTemplateKeys'))
    }

    const keys = state.tmpl.data.filter((f) => f.type !== 'header').map((f) => f.key)
    if (new Set(keys).size !== keys.length) {
      throw new Error(t('editor.pageData.duplicateTemplateKeys'))
    }

    if (siteStore.pageDataTemplates.some((t) => t.id === state.tmpl.id)) {
      siteStore.pageDataTemplates = sortBy(
        [
          ...siteStore.pageDataTemplates.filter((t) => t.id !== state.tmpl.id),
          cloneDeep(state.tmpl)
        ],
        'label'
      )
    } else {
      siteStore.pageDataTemplates = sortBy(
        [...siteStore.pageDataTemplates, cloneDeep(state.tmpl)],
        'label'
      )
    }
    state.selectedTemplateId = state.tmpl.id
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
}
function remove() {
  confirm({
    title: t('editor.pageData.templateDeleteConfirmTitle'),
    message: t('editor.pageData.templateDeleteConfirmText'),
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(() => {
    siteStore.pageDataTemplates = siteStore.pageDataTemplates.filter(
      (t) => t.id !== state.selectedTemplateId
    )
    state.selectedTemplateId = null
    state.tmpl = null
  })
}

// MOUNTED

onMounted(() => {
  if (siteStore.pageDataTemplates.length > 0) {
    state.tmpl = siteStore.pageDataTemplates[0]
    state.selectedTemplateId = state.tmpl.id
  } else {
    create()
  }
})
</script>

<style lang="scss">
@use 'sass:color';

.page-datatmpl {
  &-selector {
    @at-root .body--light & {
      background-color: $dark-3;
      box-shadow:
        inset 0px 1px 0 0 rgba(0, 0, 0, 0.75),
        inset 0px -1px 0 0 rgba(0, 0, 0, 0.75),
        0 -1px 0 0 rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      box-shadow:
        inset 0px 1px 0 0 rgba(0, 0, 0, 0.75),
        inset 0px -1px 0 0 rgba(0, 0, 0, 0.75),
        0 -1px 0 0 rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid color.adjust($dark-3, $lightness: 10%);
    }
  }
  &-sd {
    flex-basis: 250px;
    min-height: 500px;
    padding-top: 2px;

    @at-root .body--light & {
      background-color: $grey-3;
      border-right: 1px solid $grey-4;
    }
    @at-root .body--dark & {
      background-color: color.adjust($dark-3, $lightness: 2%);
      border-right: 1px solid $dark-5;
    }

    .w-list {
      @at-root .body--light & {
        background-color: $grey-4;
      }
      @at-root .body--dark & {
        background-color: $dark-5;
      }
    }

    .w-item {
      border-bottom: 1px solid;
      cursor: grab;

      @at-root .body--light & {
        border-bottom-color: rgba(0, 0, 0, 0.05);
      }
      @at-root .body--dark & {
        border-bottom-color: rgba(255, 255, 255, 0.05);
      }

      &:last-child {
        border-bottom: none;
      }
    }
  }
  &-content {
    .w-list {
      min-height: 200px;
      padding-bottom: 50px;
    }

    .handle {
      cursor: ns-resize;
    }
  }

  &-box {
    background-color: rgba($blue, 0.05);
    border: 2px dashed $primary;
    border-radius: 5px;
  }

  &-meta {
    border-bottom: 1px solid;

    @at-root .body--light & {
      background-color: $grey-2;
      box-shadow: inset 0 -1px 0 0 #fff;
      border-bottom-color: rgba(0, 0, 0, 0.05);

      .q-input {
        background-color: #fff;
      }
    }
    @at-root .body--dark & {
      background-color: color.adjust($dark-3, $lightness: 2%);
      box-shadow: inset 0 -1px 0 0 $dark-6;
      border-bottom-color: rgba(255, 255, 255, 0.1);

      .q-input {
        background-color: $dark-5;
      }
    }
  }

  &-scrollend {
    content: ' ';
    width: 1px;
    height: 1px;
  }
}
</style>
