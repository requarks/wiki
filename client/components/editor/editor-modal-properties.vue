<template lang='pug'>
  v-dialog(
    v-model='isShown'
    persistent
    lazy
    width='1100'
    )
    .dialog-header
      v-icon(color='white') sort_by_alpha
      .subheading.white--text.ml-2 Page Properties
      v-spacer
      v-btn.mx-0(
        outline
        dark
        @click.native='close'
        )
        v-icon(left) check
        span {{ $t('common:actions.ok') }}
    v-card.wiki-form(tile)
      v-card-text
        v-subheader.pl-0 Page Info
        v-text-field(
          ref='iptTitle'
          outline
          background-color='grey lighten-2'
          label='Title'
          counter='255'
          v-model='title'
          )
        v-text-field(
          outline
          background-color='grey lighten-2'
          label='Short Description'
          counter='255'
          v-model='description'
          persistent-hint
          hint='Shown below the title'
          )
      v-divider
      v-card-text.grey(:class='darkMode ? `darken-3-d3` : `lighten-5`')
        v-subheader.pl-0 Path &amp; Categorization
        v-container.pa-0(fluid, grid-list-lg)
          v-layout(row, wrap)
            v-flex(xs12, md2)
              v-select(
                outline
                background-color='grey lighten-2'
                label='Locale'
                suffix='/'
                :items='namespaces'
                v-model='locale'
                hide-details
                :disabled='mode !== "create"'
              )
            v-flex(xs12, md10)
              v-text-field(
                outline
                background-color='grey lighten-2'
                label='Path'
                append-icon='folder'
                v-model='path'
                hint='Do not include any leading or trailing slashes.'
                persistent-hint
                @click:append='showPathSelector'
                :disabled='mode !== "create"'
                )
        v-combobox(
          background-color='grey lighten-2'
          chips
          deletable-chips
          label='Tags'
          outline
          multiple
          v-model='tags'
          single-line
          hint='Use tags to categorize your pages and make them easier to find.'
          persistent-hint
          )
      v-divider
      v-card-text.pb-5.grey(:class='darkMode ? `darken-3-d5` : `lighten-4`')
        v-subheader.pl-0 Publishing State
        v-container.pa-0(fluid, grid-list-lg)
          v-layout(row, wrap)
            v-flex(xs12, md4)
              v-switch(
                label='Published'
                v-model='isPublished'
                color='primary'
                hint='Unpublished pages can still be seen by users having write permissions on this page.'
                persistent-hint
                )
            v-flex(xs12, md4)
              v-dialog(
                ref='menuPublishStart'
                lazy
                :close-on-content-click='false'
                v-model='isPublishStartShown'
                :return-value.sync='publishStartDate'
                full-width
                width='460px'
                :disabled='!isPublished'
                )
                v-text-field(
                  slot='activator'
                  label='Publish starting on...'
                  v-model='publishStartDate'
                  prepend-icon='event'
                  readonly
                  outline
                  background-color='grey lighten-2'
                  clearable
                  hint='Leave empty for no start date'
                  persistent-hint
                  :disabled='!isPublished'
                  )
                v-date-picker(
                  v-model='publishStartDate'
                  :min='(new Date()).toISOString().substring(0, 10)'
                  color='primary'
                  reactive
                  scrollable
                  landscape
                  )
                  v-spacer
                  v-btn(
                    flat=''
                    color='primary'
                    @click='isPublishStartShown = false'
                    ) Cancel
                  v-btn(
                    flat=''
                    color='primary'
                    @click='$refs.menuPublishStart.save(publishStartDate)'
                    ) OK
            v-flex(xs12, md4)
              v-dialog(
                ref='menuPublishEnd'
                lazy
                :close-on-content-click='false'
                v-model='isPublishEndShown'
                :return-value.sync='publishEndDate'
                full-width
                width='460px'
                :disabled='!isPublished'
                )
                v-text-field(
                  slot='activator'
                  label='Publish ending on...'
                  v-model='publishEndDate'
                  prepend-icon='event'
                  readonly
                  outline
                  background-color='grey lighten-2'
                  clearable
                  hint='Leave empty for no end date'
                  persistent-hint
                  :disabled='!isPublished'
                  )
                v-date-picker(
                  v-model='publishEndDate'
                  :min='(new Date()).toISOString().substring(0, 10)'
                  color='primary'
                  reactive
                  scrollable
                  landscape
                  )
                  v-spacer
                  v-btn(
                    flat=''
                    color='primary'
                    @click='isPublishEndShown = false'
                    ) Cancel
                  v-btn(
                    flat=''
                    color='primary'
                    @click='$refs.menuPublishEnd.save(publishEndDate)'
                    ) OK

    page-selector(mode='create', v-model='pageSelectorShown', :path='path', :locale='locale', :open-handler='setPath')
    v-tour(name='editorPropertiesTour', :steps='tourSteps')
</template>

<script>
import _ from 'lodash'
import { sync, get } from 'vuex-pathify'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isPublishStartShown: false,
      isPublishEndShown: false,
      pageSelectorShown: false,
      namespaces: ['en'],
      tourSteps: [
        {
          target: '.dialog-header',
          content: `First-time tour help here. <strong>TODO</strong>!`
        }
      ]
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    darkMode: get('site/dark'),
    mode: get('editor/mode'),
    title: sync('page/title'),
    description: sync('page/description'),
    locale: sync('page/locale'),
    tags: sync('page/tags'),
    path: sync('page/path'),
    isPublished: sync('page/isPublished'),
    publishStartDate: sync('page/publishStartDate'),
    publishEndDate: sync('page/publishEndDate')
  },
  watch: {
    value(newValue, oldValue) {
      if(newValue) {
        _.delay(() => {
          this.$refs.iptTitle.focus()
          // this.$tours['editorPropertiesTour'].start()
        }, 500)
      }
    }
  },
  methods: {
    close() {
      this.isShown = false
    },
    showPathSelector() {
      this.pageSelectorShown = true
    },
    setPath({ path, locale }) {
      this.locale = locale
      this.path = path
    }
  }
}
</script>

<style lang='scss'>

</style>
