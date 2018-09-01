<template lang='pug'>
  v-card(tile, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"')
    .pa-3.pt-4
      .headline.primary--text Search Engine
      .subheading.grey--text Configure the search capabilities of your wiki
    v-tabs(:color='$vuetify.dark ? "primary" : "grey lighten-4"', fixed-tabs, :slider-color='$vuetify.dark ? "white" : "primary"', show-arrows)
      v-tab(key='settings'): v-icon settings
      v-tab(key='db') Database
      v-tab(key='algolia') Algolia
      v-tab(key='elasticsearch') Elasticsearch
      v-tab(key='solr') Solr

      v-tab-item(key='settings')
        v-card.pa-3(flat, tile)
          v-form
            .body-2.grey--text.text--darken-1 Select the search engine to use:
            .caption.grey--text.pb-2 Some engines require additional configuration in their dedicated tab (when selected).
            v-radio-group(v-model='selectedEngine')
              v-radio(v-for='(engine, n) in engines', :key='n', :label='engine.text', :value='engine.value', color='primary')
      v-tab-item(key='db')
        v-card.pa-3 TODO
      v-tab-item(key='algolia')
        v-card.pa-3 TODO
      v-tab-item(key='elasticsearch')
        v-card.pa-3 TODO
      v-tab-item(key='solr')
        v-card.pa-3 TODO

    v-card-chin
      v-btn(color='primary', @click='save')
        v-icon(left) chevron_right
        span Apply Configuration
      v-btn(color='black', dark)
        v-icon(left) refresh
        | Rebuild Index
      v-spacer
      v-btn(icon, @click='refresh')
        v-icon.grey--text refresh

</template>

<script>
export default {
  data() {
    return {
      engines: [
        { text: 'Disabled', value: 'disabled' },
        { text: 'Database (built-in)', value: 'db' },
        { text: 'Algolia', value: 'algolia' },
        { text: 'Elasticsearch', value: 'elasticsearch' },
        { text: 'Solr', value: 'solr' }
      ],
      selectedEngine: 'db',
      darkMode: false
    }
  }
}
</script>

<style lang='scss'>

</style>
