<template lang="pug">
  v-footer.justify-center(:color='color', inset)
    .caption.grey--text.text--darken-1
      span(v-if='company && company.length > 0') {{ $t('common:footer.copyright', { company: company, year: currentYear }) }} |&nbsp;
      span {{ $t('common:footer.poweredBy') }} Wiki.js

    v-snackbar(
      :color='notification.style'
      bottom,
      right,
      multi-line,
      v-model='notificationState'
    )
      .text-xs-left
        v-icon.mr-3(dark) {{ notification.icon }}
        span {{ notification.message }}
</template>

<script>
import { get, sync } from 'vuex-pathify'

export default {
  props: {
    altbg: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      currentYear: (new Date()).getFullYear()
    }
  },
  computed: {
    company: get('site/company'),
    notification: get('notification'),
    darkMode: get('site/dark'),
    notificationState: sync('notification@isActive'),
    color() {
      if (this.altbg) {
        return 'altbg'
      } else if (!this.darkMode) {
        return 'grey lighten-3'
      } else {
        return ''
      }
    }
  }
}
</script>

<style lang="scss">
  .v-footer.altbg {
    background: mc('theme', 'primary');

    span {
      color: mc('blue', '300');
    }
  }
</style>
