<template lang="pug">
q-card.page-properties-dialog
  .floating-sidepanel-quickaccess.animated.fadeIn(v-if='showQuickAccess', style='right: 486px;')
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
    .text-subtitle2 {{$t('editor.props.pageProperties')}}
    q-space
    q-btn(
      icon='las la-times'
      dense
      flat
      v-close-popup
    )
  q-scroll-area(
    ref='scrollArea'
    :thumb-style='thumbStyle'
    :bar-style='barStyle'
    style='height: calc(100% - 50px);'
    )
    q-card-section(ref='card-info')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-info-circle', size='xs')] {{$t('editor.props.info')}}
      q-form.q-gutter-sm
        q-input(
          v-model='title'
          :label='$t(`editor.props.title`)'
          outlined
          dense
        )
        q-input(
          v-model='description'
          :label='$t(`editor.props.shortDescription`)'
          outlined
          dense
        )
    q-card-section.alt-card(ref='card-publishstate')
      .text-overline.q-pb-xs.items-center.flex #[q-icon.q-mr-sm(name='las la-power-off', size='xs')] {{$t('editor.props.publishState')}}
      q-form.q-gutter-md
        div
          q-btn-toggle(
            v-model='isPublished'
            push
            glossy
            no-caps
            toggle-color='primary'
            :options=`[
              { label: $t('editor.props.draft'), value: false },
              { label: $t('editor.props.published'), value: true },
              { label: $t('editor.props.dateRange'), value: null }
            ]`
          )
        .text-caption(v-if='isPublished'): em {{$t('editor.props.publishedHint')}}
        .text-caption(v-else-if='isPublished === false'): em {{$t('editor.props.draftHint')}}
        template(v-else-if='isPublished === null')
          .text-caption: em {{$t('editor.props.dateRangeHint')}}
          q-date(
            v-model='publishingRange'
            range
            flat
            bordered
            landscape
            minimal
            )
    q-card-section(ref='card-relations')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-sun', size='xs')] {{$t('editor.props.relations')}}
      q-list.rounded-borders.q-mb-sm.bg-white(
        v-if='relations.length > 0'
        separator
        bordered
        )
        q-item(v-for='rel of relations', :key='`rel-id-` + rel.id')
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
        :label='$t(`editor.props.relationAdd`)'
        icon='las la-plus'
        no-caps
        unelevated
        color='secondary'
        @click='newRelation'
        )
        q-tooltip {{$t('editor.props.relationAddHint')}}
    q-card-section.alt-card(ref='card-scripts')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-code', size='xs')] {{$t('editor.props.scripts')}}
      q-btn.full-width(
        :label='$t(`editor.props.jsLoad`)'
        icon='lab la-js-square'
        no-caps
        unelevated
        color='secondary'
        @click='editScripts(`jsLoad`)'
        )
        q-tooltip {{$t('editor.props.jsLoadHint')}}
      q-btn.full-width.q-mt-sm(
        :label='$t(`editor.props.jsUnload`)'
        icon='lab la-js-square'
        no-caps
        unelevated
        color='secondary'
        @click='editScripts(`jsUnload`)'
        )
        q-tooltip {{$t('editor.props.jsUnloadHint')}}
      q-btn.full-width.q-mt-sm(
        :label='$t(`editor.props.styles`)'
        icon='lab la-css3-alt'
        no-caps
        unelevated
        color='secondary'
        @click='editScripts(`styles`)'
        )
        q-tooltip {{$t('editor.props.stylesHint')}}
    q-card-section.q-pb-lg(ref='card-sidebar')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-ruler-vertical', size='xs')] {{$t('editor.props.sidebar')}}
      q-form.q-gutter-md.q-pt-sm
        div
          q-toggle(
            v-model='showSidebar'
            dense
            :label='$t(`editor.props.showSidebar`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-if='showSidebar'
            v-model='showToc'
            dense
            :label='$t(`editor.props.showToc`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div(
          v-if='showSidebar && showToc'
          style='padding-left: 40px;'
          )
          .text-caption {{$t('editor.props.tocMinMaxDepth')}} #[strong (H{{tocDepth.min}} &rarr; H{{tocDepth.max}})]
          q-range(
            v-model='tocDepth'
            :min='1'
            :max='6'
            color='primary'
            :left-label-value='`H` + tocDepth.min'
            :right-label-value='`H` + tocDepth.max'
            snap
            label
            markers
          )
        div
          q-toggle(
            v-if='showSidebar'
            v-model='showTags'
            dense
            :label='$t(`editor.props.showTags`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
    q-card-section.alt-card.q-pb-lg(ref='card-social')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-comments', size='xs')] {{$t('editor.props.social')}}
      q-form.q-gutter-md.q-pt-sm
        div
          q-toggle(
            v-model='allowComments'
            dense
            :label='$t(`editor.props.allowComments`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-model='allowContributions'
            dense
            :label='$t(`editor.props.allowContributions`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-model='allowRatings'
            dense
            :label='$t(`editor.props.allowRatings`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
    q-card-section.q-pb-lg(ref='card-tags')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-tags', size='xs')] {{$t('editor.props.tags')}}
      page-tags(edit)
    q-card-section.alt-card.q-pb-lg(ref='card-visibility')
      .text-overline.items-center.flex #[q-icon.q-mr-sm(name='las la-eye', size='xs')] {{$t('editor.props.visibility')}}
      q-form.q-gutter-md.q-pt-sm
        div
          q-toggle(
            v-model='showInTree'
            dense
            :label='$t(`editor.props.showInTree`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div
          q-toggle(
            v-model='requirePassword'
            dense
            :label='$t(`editor.props.requirePassword`)'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
          )
        div(
          v-if='requirePassword'
          style='padding-left: 40px;'
          )
          q-input(
            ref='iptPagePassword'
            v-model='password'
            :label='$t(`editor.props.password`)'
            :hint='$t(`editor.props.passwordHint`)'
            outlined
            dense
          )
  q-dialog(
    v-model='showRelationDialog'
    )
    page-relation-dialog(:edit-id='editRelationId')

  q-dialog(
    v-model='showScriptsDialog'
    )
    page-scripts-dialog(:mode='pageScriptsMode')
</template>

<script>
import { get, sync } from 'vuex-pathify'
import PageRelationDialog from './PageRelationDialog.vue'
import PageScriptsDialog from './PageScriptsDialog.vue'
import PageTags from './PageTags.vue'

export default {
  components: {
    PageRelationDialog,
    PageScriptsDialog,
    PageTags
  },
  data () {
    return {
      showRelationDialog: false,
      showScriptsDialog: false,
      publishingRange: {},
      requirePassword: false,
      password: '',
      editRelationId: null,
      pageScriptsMode: 'jsLoad',
      showQuickAccess: true
    }
  },
  computed: {
    title: sync('page/title', false),
    description: sync('page/description', false),
    showInTree: sync('page/showInTree', false),
    isPublished: sync('page/isPublished', false),
    relations: sync('page/relations', false),
    showSidebar: sync('page/showSidebar', false),
    showToc: sync('page/showToc', false),
    showTags: sync('page/showTags', false),
    tocDepth: sync('page/tocDepth', false),
    allowComments: sync('page/allowComments', false),
    allowContributions: sync('page/allowContributions', false),
    allowRatings: sync('page/allowRatings', false),
    thumbStyle: get('site/thumbStyle', false),
    barStyle: get('site/barStyle', false),
    quickaccess () {
      return [
        { key: 'info', icon: 'las la-info-circle', label: this.$t('editor.props.info') },
        { key: 'publishstate', icon: 'las la-power-off', label: this.$t('editor.props.publishState') },
        { key: 'relations', icon: 'las la-sun', label: this.$t('editor.props.relations') },
        { key: 'scripts', icon: 'las la-code', label: this.$t('editor.props.scripts') },
        { key: 'sidebar', icon: 'las la-ruler-vertical', label: this.$t('editor.props.sidebar') },
        { key: 'social', icon: 'las la-comments', label: this.$t('editor.props.social') },
        { key: 'tags', icon: 'las la-tags', label: this.$t('editor.props.tags') },
        { key: 'visibility', icon: 'las la-eye', label: this.$t('editor.props.visibility') }
      ]
    }
  },
  watch: {
    requirePassword (newValue) {
      if (newValue) {
        this.$nextTick(() => {
          this.$refs.iptPagePassword.focus()
          this.$refs.iptPagePassword.$el.scrollIntoView({
            behavior: 'smooth'
          })
        })
      }
    }
  },
  mounted () {
    setTimeout(() => {
      this.showQuickAccess = true
    }, 300)
  },
  methods: {
    editScripts (mode) {
      this.pageScriptsMode = mode
      this.showScriptsDialog = true
    },
    newRelation () {
      this.editRelationId = null
      this.showRelationDialog = true
    },
    editRelation (rel) {
      this.editRelationId = rel.id
      this.showRelationDialog = true
    },
    removeRelation (rel) {
      this.relations = this.$store.get('page/relations').filter(r => r.id !== rel.id)
    },
    jumpToSection (id) {
      this.$refs[`card-${id}`].$el.scrollIntoView({
        behavior: 'smooth'
      })
      // this.$refs.scrollArea.setScrollPosition(offset, 600)
    }
  }
}
</script>
