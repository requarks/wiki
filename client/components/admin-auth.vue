<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Authentication
        .subheading.grey--text Configure the authentication settings of your wiki
      v-tabs(color='grey lighten-4', grow, slider-color='primary', show-arrows)
        v-tab(key='settings'): v-icon settings
        v-tab(key='db') Local
        v-tab(key='algolia') Auth0
        v-tab(key='elasticsearch') Azure AD
        v-tab(key='solr') Discord
        v-tab(key='solr') Dropbox
        v-tab(key='solr') Facebook
        v-tab(key='solr') GitHub
        v-tab(key='solr') Google
        v-tab(key='solr') LDAP
        v-tab(key='solr') Microsoft
        v-tab(key='solr') OAuth2 Generic
        v-tab(key='solr') Slack
        v-tab(key='solr') Twitch

        v-tab-item(key='settings')
          v-card.pa-3
            v-form
              v-checkbox(v-for='(engine, n) in engines', v-model='auths', :key='n', :label='engine.text', :value='engine.value', color='primary')
              v-divider
              v-btn(color='primary')
                v-icon(left) chevron_right
                | Set Providers
              v-btn(color='black', dark)
                v-icon(left) layers_clear
                | Flush Sessions
</template>

<script>
export default {
  data() {
    return {
      engines: [
        { text: 'Local', value: 'local' },
        { text: 'Auth0', value: 'auth0' },
        { text: 'Algolia', value: 'algolia' },
        { text: 'Elasticsearch', value: 'elasticsearch' },
        { text: 'Solr', value: 'solr' }
      ],
      auths: ['local']
    }
  }
}
</script>

<style lang='scss'>

</style>
