<template lang='pug'>
  v-container(fluid, fill-height)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header-icon: v-icon(size='80', color='grey lighten-2') show_chart
        .headline.primary--text Statistics
        .subtitle-1.grey--text Useful information about your wiki
        .pa-3
          fingerprint-spinner(
            :animation-duration='1500'
            :size='128'
            color='#e91e63'
            )
          .caption.pink--text.mt-3 Compiling latest data...
</template>

<script>
import { FingerprintSpinner } from 'epic-spinners'

export default {
  components: {
    FingerprintSpinner
  },
  data() {
    return {}
  }
}
</script>

<style lang='scss'>

</style>
