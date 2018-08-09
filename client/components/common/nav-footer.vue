<template lang="pug">
  v-footer.justify-center(:color='darkMode ? "" : "grey lighten-3"', inset)
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
  data() {
    return {
      currentYear: (new Date()).getFullYear()
    }
  },
  computed: {
    company: get('site/company'),
    notification: get('notification'),
    darkMode: get('site/dark'),
    notificationState: sync('notification@isActive')
  }
}
</script>
