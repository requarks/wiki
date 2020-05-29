<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/_assets/svg/icon-console.svg', alt='Developer Tools', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Developer Tools
            .subtitle-1.grey--text Flags
          v-spacer
          v-btn(color='success', depressed, @click='save', large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

        v-card.mt-3(:class='$vuetify.theme.dark ? `grey darken-3-d5` : `white grey--text text--darken-3`')
          v-alert(color='red', :value='true', icon='mdi-alert', dark, prominent)
            span Do NOT enable these flags unless you know what you're doing!
            .caption Doing so may result in data loss or broken installation!
          v-card-text
            v-switch.mt-3(
              color='primary'
              hint='Log detailed debug info on LDAP/AD login attempts.'
              persistent-hint
              label='LDAP Debug'
              v-model='flags.ldapdebug'
              inset
            )
            v-divider.mt-3
            v-switch.mt-3(
              color='red'
              hint='Log all queries made to the database to console.'
              persistent-hint
              label='SQL Query Logging'
              v-model='flags.sqllog'
              inset
            )
</template>

<script>
import _ from 'lodash'

import flagsQuery from 'gql/admin/dev/dev-query-flags.gql'
import flagsMutation from 'gql/admin/dev/dev-mutation-save-flags.gql'

export default {
  data() {
    return {
      flags: {
        sqllog: false
      }
    }
  },
  methods: {
    async save() {
      try {
        await this.$apollo.mutate({
          mutation: flagsMutation,
          variables: {
            flags: _.transform(this.flags, (result, value, key) => {
              result.push({ key, value })
            }, [])
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-dev-flags-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Flags applied successfully.',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  },
  apollo: {
    flags: {
      query: flagsQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.transform(data.system.flags, (result, row) => {
        _.set(result, row.key, row.value)
      }, {}),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-dev-flags-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
