<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-search.svg', alt='Search Engine', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Search Engine
            .subheading.grey--text Configure the search capabilities of your wiki
          v-spacer
          v-btn(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn(color='black', dark, large, depressed, @click='rebuild')
            v-icon(left) cached
            span Rebuild Index
          v-btn(color='success', @click='save', depressed, large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}

        v-card.mt-3
          v-tabs(color='grey darken-2', fixed-tabs, slider-color='white', show-arrows, dark)
            v-tab(key='settings'): v-icon settings
            v-tab(v-for='engine in activeEngines', :key='engine.key') {{ engine.title }}

            v-tab-item(key='settings', :transition='false', :reverse-transition='false')
              v-card.pa-3(flat, tile)
                .body-2.grey--text.text--darken-1 Select which search engine to enable:
                .caption.grey--text.pb-2 Some search engines require additional configuration in their dedicated tab (when selected).
                v-form
                  v-radio-group(v-model='selectedEngine')
                    v-radio.my-1(
                      v-for='(engine, n) in engines'
                      :key='engine.key'
                      :label='engine.title'
                      :value='engine.key'
                      color='primary'
                      hide-details
                      disabled
                    )

            v-tab-item(v-for='(engine, n) in activeEngines', :key='engine.key', :transition='false', :reverse-transition='false')
              v-card.pa-3(flat, tile)
                v-form
                  .enginelogo
                    img(:src='engine.logo', :alt='engine.title')
                  v-subheader.pl-0 {{engine.title}}
                  .caption {{engine.description}}
                  .caption: a(:href='engine.website') {{engine.website}}
                  v-divider.mt-3
                  v-subheader.pl-0 Engine Configuration
                  .body-1.ml-3(v-if='!engine.config || engine.config.length < 1') This engine has no configuration options you can modify.
                  template(v-else, v-for='cfg in logger.config')
                    v-select(
                      v-if='cfg.value.type === "string" && cfg.value.enum'
                      outline
                      background-color='grey lighten-2'
                      :items='cfg.value.enum'
                      :key='cfg.key'
                      :label='cfg.value.title'
                      v-model='cfg.value.value'
                      prepend-icon='settings_applications'
                      :hint='cfg.value.hint ? cfg.value.hint : ""'
                      persistent-hint
                      :class='cfg.value.hint ? "mb-2" : ""'
                    )
                    v-switch(
                      v-else-if='cfg.value.type === "boolean"'
                      :key='cfg.key'
                      :label='cfg.value.title'
                      v-model='cfg.value.value'
                      color='primary'
                      prepend-icon='settings_applications'
                      :hint='cfg.value.hint ? cfg.value.hint : ""'
                      persistent-hint
                      )
                    v-text-field(
                      v-else
                      outline
                      background-color='grey lighten-2'
                      :key='cfg.key'
                      :label='cfg.value.title'
                      v-model='cfg.value.value'
                      prepend-icon='settings_applications'
                      :hint='cfg.value.hint ? cfg.value.hint : ""'
                      persistent-hint
                      :class='cfg.value.hint ? "mb-2" : ""'
                      )
</template>

<script>
import _ from 'lodash'

import enginesQuery from 'gql/admin/search/search-query-engines.gql'
import enginesSaveMutation from 'gql/admin/search/search-mutation-save-engines.gql'

export default {
  data() {
    return {
      engines: [],
      selectedEngine: 'db'
    }
  },
  computed: {
    activeEngines() {
      return _.filter(this.engines, 'isEnabled')
    }
  },
  watch: {
    selectedEngine(newValue, oldValue) {
      this.engines.forEach(engine => {
        if (engine.key === newValue) {
          engine.isEnabled = true
        } else {
          engine.isEnabled = false
        }
      })
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.engines.refetch()
      this.$store.commit('showNotification', {
        message: 'List of search engines has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    async save() {
      this.$store.commit(`loadingStart`, 'admin-search-saveengines')
      await this.$apollo.mutate({
        mutation: enginesSaveMutation,
        variables: {
          engines: this.engines.map(tgt => _.pick(tgt, [
            'isEnabled',
            'key',
            'config'
          ])).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.stringify({ v: cfg.value.value })}))}))
        }
      })
      this.$store.commit('showNotification', {
        message: 'Search engine configuration saved successfully.',
        style: 'success',
        icon: 'check'
      })
      this.$store.commit(`loadingStop`, 'admin-search-saveengines')
    },
    async rebuild () {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    }
  },
  apollo: {
    engines: {
      query: enginesQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.search.searchEngines).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.parse(cfg.value)}))})),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-search-refresh')
      }
    }
  }
}
</script>

<style lang='scss' scoped>

.enginelogo {
  width: 250px;
  height: 85px;
  float:right;
  display: flex;
  justify-content: flex-end;
  align-items: center;

  img {
    max-width: 100%;
    max-height: 50px;
  }
}

</style>
