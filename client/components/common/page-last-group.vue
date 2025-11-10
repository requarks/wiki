<template lang='pug'>
  v-dialog(
    v-model='isShown'
    max-width='550'
    persistent
    :overlay-color='colors.alert.warning'
    overlay-opacity='.7'
  )
    v-card
      .dialog-header.is-short(:style='"background-color: " + colors.alert.warning')
        v-icon.mr-2(color='white') mdi-alert
        span Data Privacy Notice – Site Access Removed
      v-card-text.pt-5
        div.body-2
          strong {{ userName }}
          |  has been unassigned from their last group linked to the following site(s):
          strong {{ siteNames }}.
          br
          | As a result, access to the site(s) has been fully removed. If no new group assignment is made within 3 months, their data within the site(s) will be anonymized to protect privacy.
        div.caption.mt-5
          | You can restore access by reassigning 
          strong {{ userName }}
          |  to one or more group(s) with access to the affected site(s) within the next 3 months.
      v-card-chin
        v-spacer
        v-btn(text, @click='discard', :disabled='loading') {{$t('common:actions.cancel')}}
        v-btn.px-4(
          color='red darken-3',
          @click='confirmUnassign',
          :loading='loading'
        ).white--text Unassign
</template>

<script>
import colors from '@/themes/default/js/color-scheme'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    },
    sites: {
      type: Array,
      default: () => []
    },
    userName: {
      type: String,
      default: 'The user'
    }
  },
  data() {
    return {
      loading: false,
      colors: colors
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    siteNames() {
      return ' ' + this.sites.map(s => s.name).join(', ')
    }
  },
  methods: {
    discard() {
      this.$emit('discard')
      this.isShown = false
    },
    confirmUnassign() {
      this.$emit('confirm')
      this.isShown = false
    }
  }
}
</script>
