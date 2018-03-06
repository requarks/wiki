<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Authentication
        .subheading.grey--text Configure the authentication settings of your wiki
      v-tabs(color='grey lighten-4', grow, slider-color='primary', show-arrows)
        v-tab(key='settings'): v-icon settings
        v-tab(v-for='provider in providers', :key='provider.key') {{ provider.title }}

        v-tab-item(key='settings', :transition='false', :reverse-transition='false')
          v-card.pa-3
            .body-2.pb-2 Select which authentication providers are enabled:
            v-form
              v-checkbox(
                v-for='(provider, n) in providers',
                v-model='auths',
                :key='provider.key',
                :label='provider.title',
                :value='provider.key',
                color='primary',
                :disabled='provider.key === `local`'
                hide-details
              )
              v-divider
              v-btn(color='primary')
                v-icon(left) chevron_right
                | Set Providers
              v-btn(color='black', dark)
                v-icon(left) layers_clear
                | Flush Sessions
              v-btn(icon, @click='refresh')
                v-icon.grey--text refresh

        v-tab-item(v-for='(provider, n) in providers', :key='provider.key', :transition='false', :reverse-transition='false')
          v-card.pa-3
            .body-1(v-if='!provider.props || provider.props.length < 1') This provider has no configuration options you can modify.
            v-form(v-else)
              v-text-field(v-for='prop in provider.props', :key='prop', :label='prop', prepend-icon='mode_edit')
              v-divider
              v-btn(color='primary')
                v-icon(left) chevron_right
                | Save Configuration

    v-snackbar(
      color='success'
      top
      v-model='refreshCompleted'
    )
      v-icon.mr-3(dark) cached
      | List of providers has been refreshed.
</template>

<script>
/* global CONSTANTS */

export default {
  data() {
    return {
      providers: [],
      auths: ['local'],
      refreshCompleted: false
    }
  },
  apollo: {
    providers: {
      query: CONSTANTS.GRAPH.AUTHENTICATION.QUERY_PROVIDERS,
      update: (data) => data.authentication.providers
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.providers.refetch()
      this.refreshCompleted = true
    }
  }
}
</script>

<style lang='scss'>

</style>
