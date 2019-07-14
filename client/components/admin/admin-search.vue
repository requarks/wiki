<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-search.svg', alt='Search Engine', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:search.title')}}
            .subheading.grey--text.animated.fadeInLeft.wait-p2s {{$t('admin:search.subtitle')}}
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn.animated.fadeInDown.wait-p1s(color='black', dark, large, depressed, @click='rebuild')
            v-icon(left) cached
            span {{$t('admin:search.rebuildIndex')}}
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subheading {{$t('admin:search.searchEngine')}}
          v-list.py-0(two-line, dense)
            template(v-for='(eng, idx) in engines')
              v-list-tile(:key='eng.key', @click='selectedEngine = eng.key', :disabled='!eng.isAvailable')
                v-list-tile-avatar
                  v-icon(color='grey', v-if='!eng.isAvailable') cancel
                  v-icon(color='primary', v-else-if='eng.key === selectedEngine') radio_button_checked
                  v-icon(color='grey', v-else) radio_button_unchecked
                v-list-tile-content
                  v-list-tile-title.body-2(:class='!eng.isAvailable ? `grey--text` : (selectedEngine === eng.key ? `primary--text` : ``)') {{ eng.title }}
                  v-list-tile-sub-title.caption(:class='!eng.isAvailable ? `grey--text text--lighten-1` : (selectedEngine === eng.key ? `blue--text ` : ``)') {{ eng.description }}
                v-list-tile-avatar(v-if='selectedEngine === eng.key')
                  v-icon.animated.fadeInLeft(color='primary') arrow_forward_ios
              v-divider(v-if='idx < engines.length - 1')

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
            v-subheader.pl-0 {{$t('admin:search.engineConfig')}}
            .body-1.ml-3(v-if='!engine.config || engine.config.length < 1') {{$t('admin:search.engineNoConfig')}}
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
              v-textarea(
                v-else-if='cfg.value.type === "string" && cfg.value.multiline'
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
        message: this.$t('admin:search.listRefreshSuccess'),
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
            message: this.$t('admin:search.configSaveSuccess'),
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(_.get(resp, 'data.search.updateSearchEngines.responseResult.message', this.$t('common:error.unexpected')))
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
            message: this.$t('admin:search.indexRebuildSuccess'),
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(_.get(resp, 'data.search.rebuildIndex.responseResult.message', this.$t('common:error.unexpected')))
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
