<template lang="pug">
q-card.page-properties-dialog
  .floating-sidepanel-quickaccess.animated.fadeIn(v-if='state.showQuickAccess', style='right: 486px;')
    template(v-for='(qa, idx) of quickaccess', :key='`qa-` + qa.key')
      q-btn(
        :icon='qa.icon'
        flat
        padding='sm xs'
        size='sm'
        @click='jumpToSection(qa.key)'
        )
        q-tooltip(anchor='center left' self='center right') {{qa.label}}
      q-separator(dark, v-if='idx < quickaccess.length - 1')
  q-toolbar.bg-primary.text-white.flex
    .text-subtitle2 {{t('editor.props.pageProperties')}}
    q-space
    q-btn.q-mr-sm(
      dense
      flat
      rounded
      color='white'
      icon='las la-question-circle'
      :href='siteStore.docsBase + `/editor/properties`'
      target='_blank'
      type='a'
    )
    q-btn(
      icon='las la-times'
      dense
      flat
      v-close-popup
    )
  q-scroll-area(
    ref='scrollArea'
    :thumb-style='siteStore.scrollStyle.thumb'
    :bar-style='siteStore.scrollStyle.bar'
    style='height: calc(100% - 50px);'
    )
    q-card-section(id='refCardInfo')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-info-circle', size='xs')] {{t('editor.props.info')}}
      q-form.q-gutter-sm
        q-input(
          v-model='pageStore.title'
          :label='t(`editor.props.title`)'
          outlined
          dense
        )
        q-input(
          v-model='pageStore.description'
          :label='t(`editor.props.shortDescription`)'
          outlined
          dense
        )
        q-input(
          v-model='pageStore.icon'
          :label='t(`editor.props.icon`)'
          outlined
          dense
          )
          template(#append)
            q-icon.cursor-pointer(
              name='las la-icons'
              color='primary'
            )
        q-input(
          v-if='pageStore.path !== `home`'
          v-model='pageStore.alias'
          :label='t(`editor.props.alias`)'
          outlined
          dense
          prefix='/a/'
        )
    q-card-section.alt-card(id='refCardPublishState')
      .text-overline.q-pb-xs.items-center.flex #[q-icon.q-mr-sm(name='las la-power-off', size='xs')] {{t('editor.props.publishState')}}
      q-form.q-gutter-md
        div
          q-btn-toggle(
            v-model='pageStore.publishState'
            push
            glossy
            no-caps
            toggle-color='primary'
            :options=`[
              { label: t('editor.props.draft'), value: 'draft' },
              { label: t('editor.props.published'), value: 'published' },
              { label: t('editor.props.dateRange'), value: 'scheduled' }
            ]`
          )
        .text-caption(v-if='pageStore.publishState === `published`'): em {{t('editor.props.publishedHint')}}
        .text-caption(v-else-if='pageStore.publishState === `draft`'): em {{t('editor.props.draftHint')}}
        template(v-else-if='pageStore.publishState === `scheduled`')
          .text-caption: em {{t('editor.props.dateRangeHint')}}
          q-date(
            v-model='publishingRange'
            range
            flat
            bordered
            landscape
            minimal
            )
    q-card-section(id='refCardRelations')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-sun', size='xs')] {{t('editor.props.relations')}}
      q-list.rounded-borders.q-mb-sm.bg-white(
        v-if='pageStore.relations.length > 0'
        separator
        bordered
        )
        q-item(v-for='rel of pageStore.relations', :key='`rel-id-` + rel.id')
          q-item-section(side)
            q-icon(:name='rel.icon')
          q-item-section
            q-item-label: strong {{rel.label}}
            q-item-label(caption) {{rel.caption}}
          q-item-section(side)
            q-chip.q-px-sm(
              dense
              square
              color='primary'
              text-color='white'
              )
              .text-caption {{rel.position}}
          q-item-section(side)
            q-btn(
              icon='las la-pen'
              dense
              flat
              padding='none'
              @click='editRelation(rel)'
            )
          q-item-section(side)
            q-btn(
              icon='las la-times'
              dense
              flat
              padding='none'
              @click='removeRelation(rel)'
            )
      q-btn.full-width(
        :label='t(`editor.props.relationAdd`)'
        icon='las la-plus'
        no-caps
        unelevated
        color='secondary'
        @click='newRelation'
        )
        q-tooltip {{t('editor.props.relationAddHint')}}
    q-card-section.alt-card(id='refCardScripts')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-code', size='xs')] {{t('editor.props.scripts')}}
      q-btn.full-width(
        :label='t(`editor.props.jsLoad`)'
        icon='lab la-js-square'
        no-caps
        unelevated
        color='secondary'
        @click='editScripts(`jsLoad`)'
        )
        q-tooltip {{t('editor.props.jsLoadHint')}}
      q-btn.full-width.q-mt-sm(
        :label='t(`editor.props.jsUnload`)'
        icon='lab la-js-square'
        no-caps
        unelevated
        color='secondary'
        @click='editScripts(`jsUnload`)'
        )
        q-tooltip {{t('editor.props.jsUnloadHint')}}
      q-btn.full-width.q-mt-sm(
        :label='t(`editor.props.styles`)'
        icon='lab la-css3-alt'
        no-caps
        unelevated
        color='secondary'
        @click='editScripts(`styles`)'
        )
        q-tooltip {{t('editor.props.stylesHint')}}
    q-card-section.q-pb-lg(id='refCardSidebar')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-ruler-vertical', size='xs')] {{t('editor.props.sidebar')}}
      q-form.q-gutter-md.q-pt-sm
        div
          q-toggle(
            v-model='pageStore.showSidebar'
            dense
            :label='t(`editor.props.showSidebar`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-if='pageStore.showSidebar'
            v-model='pageStore.showToc'
            dense
            :label='t(`editor.props.showToc`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div(
          v-if='pageStore.showSidebar && pageStore.showToc'
          style='padding-left: 40px;'
          )
          .text-caption {{t('editor.props.tocMinMaxDepth')}} #[strong (H{{pageStore.tocDepth.min}} &rarr; H{{pageStore.tocDepth.max}})]
          q-range(
            v-model='pageStore.tocDepth'
            :min='1'
            :max='6'
            color='primary'
            :left-label-value='`H` + pageStore.tocDepth.min'
            :right-label-value='`H` + pageStore.tocDepth.max'
            snap
            label
            markers
          )
        div
          q-toggle(
            v-if='pageStore.showSidebar'
            v-model='pageStore.showTags'
            dense
            :label='t(`editor.props.showTags`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
    q-card-section.alt-card.q-pb-lg(id='refCardSocial')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-comments', size='xs')] {{t('editor.props.social')}}
      q-form.q-gutter-md.q-pt-sm
        div
          q-toggle(
            v-model='pageStore.allowComments'
            dense
            :label='t(`editor.props.allowComments`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-model='pageStore.allowContributions'
            dense
            :label='t(`editor.props.allowContributions`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-model='pageStore.allowRatings'
            dense
            :label='t(`editor.props.allowRatings`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
    q-card-section.q-pb-lg(id='refCardTags')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-tags', size='xs')] {{t('editor.props.tags')}}
      page-tags(edit)
    q-card-section.alt-card.q-pb-lg(id='refCardVisibility')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-eye', size='xs')] {{t('editor.props.visibility')}}
      q-form.q-gutter-md.q-pt-sm
        div
          q-toggle(
            v-model='pageStore.isBrowsable'
            dense
            :label='$t(`editor.props.showInTree`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-model='pageStore.isSearchable'
            dense
            :label='$t(`editor.props.isSearchable`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-model='state.requirePassword'
            @update:model-value='toggleRequirePassword'
            dense
            :label='$t(`editor.props.requirePassword`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div(
          v-if='state.requirePassword'
          style='padding-left: 40px;'
          )
          q-input(
            ref='iptPagePassword'
            v-model='pageStore.password'
            :label='t(`editor.props.password`)'
            :hint='t(`editor.props.passwordHint`)'
            outlined
            dense
          )
  q-dialog(
    v-model='state.showRelationDialog'
    )
    page-relation-dialog(:edit-id='state.editRelationId')

  q-dialog(
    v-model='state.showScriptsDialog'
    )
    page-scripts-dialog(:mode='state.pageScriptsMode')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { DateTime } from 'luxon'

import PageRelationDialog from './PageRelationDialog.vue'
import PageScriptsDialog from './PageScriptsDialog.vue'
import PageTags from './PageTags.vue'

import { useEditorStore } from 'src/stores/editor'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

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
  showRelationDialog: false,
  showScriptsDialog: false,
  requirePassword: false,
  editRelationId: null,
  pageScriptsMode: 'jsLoad',
  showQuickAccess: true
})

const quickaccess = [
  { key: 'refCardInfo', icon: 'las la-info-circle', label: t('editor.props.info') },
  { key: 'refCardPublishState', icon: 'las la-power-off', label: t('editor.props.publishState') },
  { key: 'refCardRelations', icon: 'las la-sun', label: t('editor.props.relations') },
  { key: 'refCardScripts', icon: 'las la-code', label: t('editor.props.scripts') },
  { key: 'refCardSidebar', icon: 'las la-ruler-vertical', label: t('editor.props.sidebar') },
  { key: 'refCardSocial', icon: 'las la-comments', label: t('editor.props.social') },
  { key: 'refCardTags', icon: 'las la-tags', label: t('editor.props.tags') },
  { key: 'refCardVisibility', icon: 'las la-eye', label: t('editor.props.visibility') }
]

// REFS

const iptPagePassword = ref(null)

// COMPUTED

const publishingRange = computed({
  get () {
    return {
      from: pageStore.publishStartDate,
      to: pageStore.publishEndDate
    }
  },
  set (newValue) {
    pageStore.publishStartDate = newValue?.from
    pageStore.publishEndDate = newValue?.to
  }
})

// WATCHERS

pageStore.$subscribe(() => {
  editorStore.$patch({
    lastChangeTimestamp: DateTime.utc()
  })
})

// METHODS

function editScripts (mode) {
  state.pageScriptsMode = mode
  state.showScriptsDialog = true
}
function newRelation () {
  state.editRelationId = null
  state.showRelationDialog = true
}
function editRelation (rel) {
  state.editRelationId = rel.id
  state.showRelationDialog = true
}
function removeRelation (rel) {
  pageStore.relations = pageStore.relations.filter(r => r.id !== rel.id)
}
function jumpToSection (id) {
  document.querySelector(`#${id}`).scrollIntoView({
    behavior: 'smooth'
  })
}
function toggleRequirePassword (newValue) {
  if (newValue) {
    nextTick(() => {
      iptPagePassword.value.focus()
      iptPagePassword.value.$el.scrollIntoView({
        behavior: 'smooth'
      })
    })
  } else {
    pageStore.password = ''
  }
}

// MOUNTED

onMounted(() => {
  state.requirePassword = pageStore.password?.length > 0

  setTimeout(() => {
    state.showQuickAccess = true
  }, 300)
})

</script>
