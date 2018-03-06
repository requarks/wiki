<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Authentication
        .subheading.grey--text Configure the authentication settings of your wiki
      v-tabs(color='grey lighten-4', grow, slider-color='primary', show-arrows)
        v-tab(key='settings'): v-icon settings
        v-tab(v-for='provider in providers', :key='provider.key') {{ provider.title }}

        v-tab-item(key='settings')
          v-card.pa-3
            v-form
              v-checkbox(v-for='(provider, n) in providers', v-model='auths', :key='provider.key', :label='provider.title', :value='provider.key', color='primary')
              v-divider
              v-btn(color='primary')
                v-icon(left) chevron_right
                | Set Providers
              v-btn(color='black', dark)
                v-icon(left) layers_clear
                | Flush Sessions
</template>

<script>
/* global CONSTANTS */

export default {
  data() {
    return {
      providers: [],
      auths: ['local']
    }
  },
  apollo: {
    providers: {
      query: CONSTANTS.GRAPH.AUTHENTICATION.QUERY_PROVIDERS,
      update: (data) => data.authentication.providers
    }
  }
}
</script>

<style lang='scss'>

</style>
