<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-search.svg', alt='Search Engine', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft Search Engine
            .subheading.grey--text.animated.fadeInLeft.wait-p2s Configure the search capabilities of your wiki
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn.animated.fadeInDown.wait-p1s(color='black', dark, large, depressed, @click='rebuild')
            v-icon(left) cached
            span Rebuild Index
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subheading Search Engine
          v-card-text
            v-radio-group.my-0(v-model='selectedEngine')
              v-radio.my-1(
                v-for='(engine, n) in engines'
                :key='engine.key'
                :label='engine.title'
                :value='engine.key'
                :disabled='!engine.isAvailable'
                color='primary'
                hide-details
              )

      v-flex(lg9, xs12)
        v-card.wiki-form.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, flat, dark)
            .subheading {{engine.title}}
          v-card-text
            .enginelogo
              img(:src='engine.logo', :alt='engine.title')
            .caption.pt-3 {{engine.description}}
            .caption.pb-3: a(:href='engine.website') {{engine.website}}
            v-divider.mt-3
            v-subheader.pl-0 Engine Configuration
            .body-1.ml-3(v-if='!engine.config || engine.config.length < 1') This engine has no configuration options you can modify.
            template(v-else, v-for='cfg in engine.config')
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
              v-switch.mb-3(
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
import enginesRebuildMutation from 'gql/admin/search/search-mutation-rebuild-index.gql'

export default {
  data() {
    return {
      engines: [],
      selectedEngine: '',
      engine: {}
    }
  },
  watch: {
    selectedEngine(newValue, oldValue) {
      this.engine = _.find(this.engines, ['key', newValue]) || {}
    },
    engines(newValue, oldValue) {
      this.selectedEngine = _.get(_.find(this.engines, 'isEnabled'), 'key', 'db')
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
      try {
        const resp = await this.$apollo.mutate({
          mutation: enginesSaveMutation,
          variables: {
            engines: this.engines.map(tgt => ({
              isEnabled: tgt.key === this.selectedEngine,
              key: tgt.key,
              config: tgt.config.map(cfg => ({...cfg, value: JSON.stringify({ v: cfg.value.value })}))
            }))
          }
        })
        if (_.get(resp, 'data.search.updateSearchEngines.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            message: 'Search engine configuration saved successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(_.get(resp, 'data.search.updateSearchEngines.responseResult.message', 'An unexpected error occured'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-search-saveengines')
    },
    async rebuild () {
      this.$store.commit(`loadingStart`, 'admin-search-rebuildindex')
      try {
        const resp = await this.$apollo.mutate({
          mutation: enginesRebuildMutation
        })
        if (_.get(resp, 'data.search.rebuildIndex.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            message: 'Index rebuilt successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(_.get(resp, 'data.search.rebuildIndex.responseResult.message', 'An unexpected error occured'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-search-rebuildindex')
    }
  },
  apollo: {
    engines: {
      query: enginesQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.search.searchEngines).map(str => ({
        ...str,
        config: _.sortBy(str.config.map(cfg => ({
          ...cfg,
          value: JSON.parse(cfg.value)
        })), [t => t.value.order])
      })),
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
