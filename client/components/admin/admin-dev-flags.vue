<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-console.svg', alt='Developer Tools', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Developer Tools
            .subheading.grey--text Flags
          v-spacer
          v-btn(color='success', depressed, @click='save', large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}

        v-card.mt-3.white.grey--text.text--darken-3
          v-alert(color='red', value='true', icon='warning')
            span Do NOT enable these flags unless you know what you're doing!
            .caption Doing so may result in data loss or broken installation!
          v-card-text
            v-switch.mt-3(
              color='red'
              hint='Log all queries made to the database to console.'
              persistent-hint
              label='SQL Query Logging'
              v-model='flags.sqllog'
            )
            //- v-divider.mt-3
            //- v-switch.mt-3(
            //-   color='primary'
            //-   hint='Log all queries made to the database to console.'
            //-   persistent-hint
            //-   label='SQL Query Log'
            //-   v-model='flags.sqllog'
            //- )

</template>

<script>
import _ from 'lodash'

export default {
  data() {
    return {
      flags: {
        sqllog: false
      }
    }
  },
  methods: {
    save() {

    }
  }
}
</script>

<style lang='scss'>

</style>
