<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Search Engine
        .subheading.grey--text Configure the search capabilities of your wiki
      v-tabs(color='grey lighten-4', grow, slider-color='primary', show-arrows)
        v-tab(key='settings'): v-icon settings
        v-tab(key='db') Database
        v-tab(key='algolia') Algolia
        v-tab(key='elasticsearch') Elasticsearch
        v-tab(key='solr') Solr

        v-tab-item(key='settings')
          v-card.pa-3
            v-form
              v-radio-group(v-model='selectedEngine')
                v-radio(v-for='(engine, n) in engines', :key='n', :label='engine.text', :value='engine.value', color='primary')
              v-divider
              v-btn(color='primary')
                v-icon(left) chevron_right
                | Set Engine
              v-btn(color='black', dark)
                v-icon(left) refresh
                | Rebuild Index
        v-tab-item(key='db')
          v-card.pa-3 TODO
        v-tab-item(key='algolia')
          v-card.pa-3 TODO
        v-tab-item(key='elasticsearch')
          v-card.pa-3 TODO
        v-tab-item(key='solr')
          v-card.pa-3 TODO

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
