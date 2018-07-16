<template lang='pug'>
  v-bottom-sheet(
    v-model='isShown'
    inset
    )
    .dialog-header
      v-icon(color='white') sort_by_alpha
      .subheading.white--text.ml-2 Page Properties
      v-spacer
      v-btn(
        outline
        dark
        @click.native='close'
        )
        v-icon(left) close
        span Close
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
        v-text-field(
          outline
          background-color='grey lighten-2'
          label='Path'
          prefix='/'
          append-icon='folder'
          v-model='path'
          )
      v-divider
      v-card-text
        v-subheader.pl-0 Tags
        v-combobox(
          background-color='grey lighten-2'
          chips
          deletable-chips
          hide-details
          label='Tags'
          outline
          multiple
          v-model='tags'
          single-line
          )
      v-divider
      v-card-text.pb-5
        v-subheader.pl-0 Publishing State
        v-container.pa-0(fluid, grid-list-lg)
          v-layout(row, wrap)
            v-flex(xs12, md4)
              v-switch(
                label='Published'
                v-model='isPublished'
                color='primary'
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
    }
  }
}
</script>

<style lang='scss'>

</style>
