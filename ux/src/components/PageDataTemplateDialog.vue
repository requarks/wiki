<template lang="pug">
q-card.page-datatmpl-dialog(style='width: 1100px; max-width: 1100px;')
  q-toolbar.bg-primary.text-white
    .text-subtitle2 {{t('editor.pageData.manageTemplates')}}
    q-space
    q-btn(
      icon='las la-times'
      dense
      flat
      v-close-popup
    )
  q-card-section.page-datatmpl-selector
    .flex.q-gutter-md
      q-select.col(
        v-model='state.selectedTemplateId'
        :options='siteStore.pageDataTemplates'
        standout
        :label='t(`editor.pageData.template`)'
        dense
        dark
        option-value='id'
        map-options
        emit-value
      )
      q-btn(
        icon='las la-plus'
        :label='t(`common.actions.new`)'
        unelevated
        color='primary'
        no-caps
        @click='create'
      )
  .row(v-if='state.tmpl')
    .col-auto.page-datatmpl-sd
      .q-pa-md
        q-btn.acrylic-btn.full-width(
          :label='t(`common.actions.howItWorks`)'
          icon='las la-question-circle'
          flat
          color='pink'
          no-caps
        )
      q-item-label(header, style='margin-top: 2px;') {{t('editor.pageData.templateFullRowTypes')}}
      .q-px-md
        draggable(
          class='q-list rounded-borders'
          :list='inventoryMisc'
          :group='{name: `shared`, pull: `clone`, put: false}'
          :clone='cloneFieldType'
          :sort='false'
          :animation='150'
          @start='state.dragStarted = true'
          @end='state.dragStarted = false'
          item-key='id'
          )
          template(#item='{element}')
            q-item(clickable)
              q-item-section(side)
                q-icon(:name='element.icon', color='primary')
              q-item-section
                q-item-label {{element.label}}
      q-item-label(header) {{t('editor.pageData.templateKeyValueTypes')}}
      .q-px-md.q-pb-md
        draggable(
          class='q-list rounded-borders'
          :list='inventoryKV'
          :group='{name: `shared`, pull: `clone`, put: false}'
          :clone='cloneFieldType'
          :sort='false'
          :animation='150'
          @start='state.dragStarted = true'
          @end='state.dragStarted = false'
          item-key='id'
          )
          template(#item='{element}')
            q-item(clickable)
              q-item-section(side)
                q-icon(:name='element.icon', color='primary')
              q-item-section
                q-item-label {{element.label}}
    .col.page-datatmpl-content
      q-scroll-area(
        ref='scrollArea'
        :thumb-style='siteStore.thumbStyle'
        :bar-style='siteStore.barStyle'
        style='height: 100%;'
        )
          .col.page-datatmpl-meta.q-px-md.q-py-md.flex.q-gutter-md
            q-input.col(
              ref='tmplTitleIpt'
              :label='t(`editor.pageData.templateTitle`)'
              outlined
              dense
              v-model='state.tmpl.label'
            )
            q-btn.acrylic-btn(
              icon='las la-check'
              :label='t(`common.actions.commit`)'
              no-caps
              flat
              color='positive'
              @click='commit'
            )
            q-btn.acrylic-btn(
              icon='las la-trash'
              :aria-label='t(`common.actions.delete`)'
              flat
              color='negative'
              @click='remove'
            )
          q-item-label(header) {{t('editor.pageData.templateStructure')}}
          .q-px-md.q-pb-md
            div(:class='(state.dragStarted || state.tmpl.data.length < 1 ? `page-datatmpl-box` : ``)')
              .text-caption.text-primary.q-pa-md(v-if='state.tmpl.data.length < 1 && !state.dragStarted'): em {{t('editor.pageData.dragDropHint')}}
              draggable(
                class='q-list rounded-borders'
                :list='state.tmpl.data'
                group='shared'
                :animation='150'
                handle='.handle'
                @end='state.dragStarted = false'
                item-key='id'
                )
                template(#item='{element}')
                  q-item
                    q-item-section(side)
                      q-icon.handle(name='las la-bars')
                    q-item-section(side)
                      q-icon(:name='element.icon', color='primary')
                    q-item-section
                      q-input(
                        :label='t(`editor.pageData.label`)'
                        v-model='element.label'
                        outlined
                        dense
                      )
                    q-item-section(v-if='element.type !== `header`')
                      q-input(
                        :label='t(`editor.pageData.uniqueKey`)'
                        v-model='element.key'
                        outlined
                        dense
                      )
                    q-item-section(side)
                      q-btn.acrylic-btn(
                        color='negative'
                        :aria-label='t(`common.actions.delete`)'
                        padding='xs'
                        icon='las la-times'
                        flat
                        @click='removeItem(item)'
                      )
          .page-datatmpl-scrollend(ref='scrollAreaEnd')

  .q-pa-md.text-center(v-else-if='siteStore.pageDataTemplates.length > 0')
    em.text-grey-6 {{t('editor.pageData.selectTemplateAbove')}}
  .q-pa-md.text-center(v-else)
    em.text-grey-6 {{t('editor.pageData.noTemplate')}}
</template>

<script setup>
import { v4 as uuid } from 'uuid'
import { cloneDeep, sortBy } from 'lodash-es'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

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
  selectedTemplateId: null,
  dragStarted: false,
  tmpl: null
})

const inventoryMisc = [
  {
    key: 'header',
    label: t('editor.pageData.fieldTypeHeader'),
    icon: 'las la-heading'
  },
  {
    key: 'image',
    label: t('editor.pageData.fieldTypeImage'),
    icon: 'las la-image'
  }
]

const inventoryKV = [
  {
    key: 'text',
    label: t('editor.pageData.fieldTypeText'),
    icon: 'las la-font'
  },
  {
    key: 'number',
    label: t('editor.pageData.fieldTypeNumber'),
    icon: 'las la-infinity'
  },
  {
    key: 'boolean',
    label: t('editor.pageData.fieldTypeBoolean'),
    icon: 'las la-check-square'
  },
  {
    key: 'link',
    label: t('editor.pageData.fieldTypeLink'),
    icon: 'las la-link'
  }
]

// REFS

const scrollAreaEnd = ref(null)
const tmplTitleIpt = ref(null)

// WATCHERS

watch(() => state.dragStarted, (newValue) => {
  if (newValue) {
    nextTick(() => {
      scrollAreaEnd.value.scrollIntoView({
        behavior: 'smooth'
      })
    })
  }
})

watch(() => state.selectedTemplateId, (newValue) => {
  state.tmpl = cloneDeep(siteStore.pageDataTemplates.find(t => t.id === state.selectedTemplateId))
})

// METHODS

function cloneFieldType (tp) {
  return {
    id: uuid(),
    type: tp.key,
    label: '',
    ...(tp.key !== 'header' ? { key: '' } : {}),
    icon: tp.icon
  }
}

function removeItem (item) {
  state.tmpl.data = state.tmpl.data.filter(i => i.id !== item.id)
}

function create () {
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

function commit () {
  try {
    if (state.tmpl.label.length < 1) {
      throw new Error(t('editor.pageData.invalidTemplateName'))
    } else if (state.tmpl.data.length < 1) {
      throw new Error(t('editor.pageData.emptyTemplateStructure'))
    } else if (state.tmpl.data.some(f => f.label.length < 1)) {
      throw new Error(t('editor.pageData.invalidTemplateLabels'))
    } else if (state.tmpl.data.some(f => f.type !== 'header' && f.key.length < 1)) {
      throw new Error(t('editor.pageData.invalidTemplateKeys'))
    }

    const keys = state.tmpl.data.filter(f => f.type !== 'header').map(f => f.key)
    if ((new Set(keys)).size !== keys.length) {
      throw new Error(t('editor.pageData.duplicateTemplateKeys'))
    }

    if (siteStore.pageDataTemplates.some(t => t.id === state.tmpl.id)) {
      siteStore.pageDataTemplates = sortBy([...siteStore.pageDataTemplates.filter(t => t.id !== state.tmpl.id), cloneDeep(state.tmpl)], 'label')
    } else {
      siteStore.pageDataTemplates = sortBy([...siteStore.pageDataTemplates, cloneDeep(state.tmpl)], 'label')
    }
    state.selectedTemplateId = state.tmpl.id
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
}
function remove () {
  $q.dialog({
    title: t('editor.pageData.templateDeleteConfirmTitle'),
    message: t('editor.pageData.templateDeleteConfirmText'),
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(() => {
    siteStore.pageDataTemplates = siteStore.pageDataTemplates.filter(t => t.id !== state.selectedTemplateId)
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
.page-datatmpl {
  &-selector {
    @at-root .body--light & {
      background-color: $dark-3;
      box-shadow: inset 0px 1px 0 0 rgba(0,0,0,.75), inset 0px -1px 0 0 rgba(0,0,0,.75), 0 -1px 0 0 rgba(255,255,255,.1);
      border-bottom: 1px solid #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      box-shadow: inset 0px 1px 0 0 rgba(0,0,0, 0.75), inset 0px -1px 0 0 rgba(0,0,0,.75), 0 -1px 0 0 rgba(255,255,255,.1);
      border-bottom: 1px solid lighten($dark-3, 10%);
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
      background-color: lighten($dark-3, 2%);
      border-right: 1px solid $dark-5;
    }

    .q-list {
      @at-root .body--light & {
        background-color: $grey-4;
      }
      @at-root .body--dark & {
        background-color: $dark-5;
      }
    }

    .q-item {
      border-bottom: 1px solid;
      cursor: grab;

      @at-root .body--light & {
        border-bottom-color: rgba(0,0,0,.05);
      }
      @at-root .body--dark & {
        border-bottom-color: rgba(255, 255, 255, .05);
      }

      &:last-child {
        border-bottom: none;
      }
    }
  }
  &-content {
    .q-list {
      min-height: 200px;
      padding-bottom: 50px;
    }

    .handle {
      cursor: ns-resize;
    }
  }

  &-box {
    background-color: rgba($blue, .05);
    border: 2px dashed $primary;
    border-radius: 5px;
  }

  &-meta {
    border-bottom: 1px solid;

    @at-root .body--light & {
      background-color: $grey-2;
      box-shadow: inset 0 -1px 0 0 #FFF;
      border-bottom-color: rgba(0,0,0,.05);

      .q-input {
        background-color: #FFF;
      }
    }
    @at-root .body--dark & {
      background-color: lighten($dark-3, 2%);
      box-shadow: inset 0 -1px 0 0 $dark-6;
      border-bottom-color: rgba(255,255,255,.1);

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
