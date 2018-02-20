<template lang='pug'>
  v-bottom-sheet(v-model='isShown', inset, persistent)
    v-toolbar(color='orange', flat)
      v-icon(color='white') vpn_lock
      v-toolbar-title.white--text Page Access
      v-spacer
      v-btn(icon, dark, @click.native='close')
        v-icon close
    v-card.pa-3(tile)
      v-form
        v-container(fluid)
          v-layout(row, wrap)
            v-flex(xs12)
              v-switch(label='Published', v-model='isPublished', color='primary')
            v-flex(xs6)
              v-menu(ref='menuPublishStart', lazy='', :close-on-content-click='false', v-model='isPublishStartShown', transition='scale-transition', offset-y='', full-width='', :nudge-right='40', min-width='290px', :return-value.sync='publishStartDate')
                v-text-field(slot='activator', label='Publish starting on...', v-model='publishStartDate', prepend-icon='event', readonly)
                v-date-picker(v-model='publishStartDate', :min='(new Date()).toISOString().substring(0, 10)', reactive)
                  v-spacer
                  v-btn(flat='', color='primary', @click='isPublishStartShown = false') Cancel
                  v-btn(flat='', color='primary', @click='$refs.menuPublishStart.save(date)') OK
            v-flex(xs6)
              v-menu(ref='menuPublishEnd', lazy='', :close-on-content-click='false', v-model='isPublishEndShown', transition='scale-transition', offset-y='', full-width='', :nudge-right='40', min-width='290px', :return-value.sync='publishEndDate')
                v-text-field(slot='activator', label='Publish ending on...', v-model='publishEndDate', prepend-icon='event', readonly)
                v-date-picker(v-model='publishEndDate', :min='(new Date()).toISOString().substring(0, 10)', reactive)
                  v-spacer
                  v-btn(flat='', color='primary', @click='isPublishEndShown = false') Cancel
                  v-btn(flat='', color='primary', @click='$refs.menuPublishEnd.save(date)') OK
      v-card-actions
        v-btn(color='green', dark) Save
        v-btn(@click.native='close') Cancel
</template>

<script>
export default {
  data() {
    return {
      isShown: false,
      isPublished: true,
      isPublishStartShown: false,
      isPublishEndShown: false,
      publishStartDate: '',
      publishEndDate: ''
    }
  },
  mounted() {
    this.isShown = true
  },
  methods: {
    close() {
      this.isShown = false
      this.$parent.closeModal()
    }
  }
}
</script>

<style lang='scss'>

</style>
