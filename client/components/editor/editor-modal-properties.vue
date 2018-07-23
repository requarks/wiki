<template lang='pug'>
  v-bottom-sheet(
    v-model='isShown'
    inset
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
      v-menu
        v-btn.is-icon(
          slot='activator'
          outline
          dark
          )
          v-icon more_horiz
        v-list
          v-list-tile
            v-list-tile-avatar: v-icon delete
            v-list-tile-title Delete Page
    v-card(tile)
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
          )
      v-divider
      v-card-text.grey.lighten-5
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
      v-card-text.pb-5.grey.lighten-4
        v-subheader.pl-0 Publishing State
        v-container.pa-0(fluid, grid-list-lg)
          v-layout(row, wrap)
            v-flex(xs12, md4)
              v-switch(
                label='Published'
                v-model='isPublished'
                color='primary'
                hint='Unpublished pages can still be seen by users having write permissions.'
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

    v-tour(name='editorPropertiesTour', :steps='tourSteps')
</template>

<script>
import _ from 'lodash'
import { sync } from 'vuex-pathify'

export default {
  data() {
    return {
      isShown: false,
      isPublishStartShown: false,
      isPublishEndShown: false,
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
    title: sync('editor/title'),
    description: sync('editor/description'),
    locale: sync('editor/locale'),
    tags: sync('editor/tags'),
    path: sync('editor/path'),
    isPublished: sync('editor/isPublished'),
    publishStartDate: sync('editor/publishStartDate'),
    publishEndDate: sync('editor/publishEndDate')
  },
  mounted() {
    this.isShown = true
    _.delay(() => {
      this.$refs.iptTitle.focus()
      // this.$tours['editorPropertiesTour'].start()
    }, 500)
  },
  methods: {
    close() {
      this.isShown = false
      this.$parent.$parent.closeModal()
    },
    showPathSelector() {
      this.$store.commit('showNotification', {
        message: 'Coming soon!',
        style: 'purple',
        icon: 'directions_boat'
      })
    }
  }
}
</script>

<style lang='scss'>

</style>
