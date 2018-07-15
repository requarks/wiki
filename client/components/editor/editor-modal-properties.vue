<template lang='pug'>
  v-bottom-sheet(
    v-model='isShown'
    inset
    persistent
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
        v-select(
          background-color='grey lighten-2'
          chips
          deletable-chips
          hide-details
          label='Tags'
          outline
          tags
          v-model='tags'
          single-line
          )
      v-divider
      v-card-text
        v-subheader.pl-0 Publishing State
        v-layout(row, wrap)
          v-flex(xs4)
            v-switch(
              label='Published'
              v-model='isPublished'
              color='primary'
              )
          v-flex(xs4)
            v-menu(
              ref='menuPublishStart'
              lazy=''
              :close-on-content-click='false'
              v-model='isPublishStartShown'
              transition='scale-transition'
              offset-y=''
              full-width=''
              :nudge-right='40'
              min-width='290px'
              :return-value.sync='publishStartDate'
              )
              v-text-field(
                slot='activator'
                label='Publish starting on...'
                v-model='publishStartDate'
                prepend-icon='event'
                readonly)
              v-date-picker(
                v-model='publishStartDate'
                :min='(new Date()).toISOString().substring(0, 10)'
                reactive
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
                  @click='$refs.menuPublishStart.save(date)'
                  ) OK
          v-flex(xs4)
            v-menu(
              ref='menuPublishEnd'
              lazy=''
              :close-on-content-click='false'
              v-model='isPublishEndShown'
              transition='scale-transition'
              offset-y=''
              full-width=''
              :nudge-right='40'
              min-width='290px'
              :return-value.sync='publishEndDate'
              )
              v-text-field(
                slot='activator'
                label='Publish ending on...'
                v-model='publishEndDate'
                prepend-icon='event'
                readonly
                )
              v-date-picker(
                v-model='publishEndDate'
                :min='(new Date()).toISOString().substring(0, 10)'
                reactive
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
                  @click='$refs.menuPublishEnd.save(date)'
                  ) OK
</template>

<script>
import { sync } from 'vuex-pathify'

export default {
  data() {
    return {
      isShown: false,
      isPublishStartShown: false,
      isPublishEndShown: false
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
