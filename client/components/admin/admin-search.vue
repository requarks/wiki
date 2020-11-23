<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-search.svg', alt='Search Engine', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:search.title')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{$t('admin:search.subtitle')}}
          v-spacer
          v-btn.mr-3.animated.fadeInDown.wait-p3s(icon, outlined, color='grey', href='https://docs.requarks.io/search', target='_blank')
            v-icon mdi-help-circle
          v-btn.animated.fadeInDown.wait-p2s(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
          v-btn.mx-3.animated.fadeInDown.wait-p1s(color='black', dark, depressed, @click='rebuild')
            v-icon(left) mdi-cached
            span {{$t('admin:search.rebuildIndex')}}
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subtitle-1 {{$t('admin:search.searchEngine')}}
          v-list.py-0(two-line, dense)
            template(v-for='(eng, idx) in engines')
              v-list-item(:key='eng.key', @click='selectedEngine = eng.key', :disabled='!eng.isAvailable')
                v-list-item-avatar(size='24')
                  v-icon(color='grey', v-if='!eng.isAvailable') mdi-minus-box-outline
                  v-icon(color='primary', v-else-if='eng.key === selectedEngine') mdi-checkbox-marked-circle-outline
                  v-icon(color='grey', v-else) mdi-checkbox-blank-circle-outline
                v-list-item-content
                  v-list-item-title.body-2(:class='!eng.isAvailable ? `grey--text` : (selectedEngine === eng.key ? `primary--text` : ``)') {{ eng.title }}
                  v-list-item-subtitle: .caption(:class='!eng.isAvailable ? `grey--text text--lighten-1` : (selectedEngine === eng.key ? `blue--text ` : ``)') {{ eng.description }}
                v-list-item-avatar(v-if='selectedEngine === eng.key', size='24')
                  v-icon.animated.fadeInLeft(color='primary', large) mdi-chevron-right
              v-divider(v-if='idx < engines.length - 1')

      v-flex(lg9, xs12)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, flat, dark)
            .subtitle-1 {{engine.title}}
          v-card-info(color='blue')
            div
              div {{engine.description}}
              span.caption: a(:href='engine.website') {{engine.website}}
            v-spacer
            .admin-providerlogo
              img(:src='engine.logo', :alt='engine.title')
          v-card-text
            .overline.mb-5 {{$t('admin:search.engineConfig')}}
            .body-2.ml-3(v-if='!engine.config || engine.config.length < 1'): em {{$t('admin:search.engineNoConfig')}}
            template(v-else, v-for='cfg in engine.config')
              v-select(
                v-if='cfg.value.type === "string" && cfg.value.enum'
                outlined
                :items='cfg.value.enum'
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                prepend-icon='mdi-cog-box'
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
                prepend-icon='mdi-cog-box'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                inset
                )
              v-textarea(
                v-else-if='cfg.value.type === "string" && cfg.value.multiline'
                outlined
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                prepend-icon='mdi-cog-box'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                :class='cfg.value.hint ? "mb-2" : ""'
                )
              v-text-field(
                v-else
                outlined
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                prepend-icon='mdi-cog-box'
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
