<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-line-chart.svg', alt='Analytics', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:analytics.title') }}
            .subheading.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:analytics.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subheading {{$t('admin:analytics.providers')}}
          v-list(two-line, dense).py-0
            template(v-for='(str, idx) in providers')
              v-list-tile(:key='str.key', @click='selectedProvider = str.key', :disabled='!str.isAvailable')
                v-list-tile-avatar
                  v-icon(color='grey', v-if='!str.isAvailable') indeterminate_check_box
                  v-icon(color='primary', v-else-if='str.isEnabled', v-ripple, @click='str.isEnabled = false') check_box
                  v-icon(color='grey', v-else, v-ripple, @click='str.isEnabled = true') check_box_outline_blank
                v-list-tile-content
                  v-list-tile-title.body-2(:class='!str.isAvailable ? `grey--text` : (selectedProvider === str.key ? `primary--text` : ``)') {{ str.title }}
                  v-list-tile-sub-title.caption(:class='!str.isAvailable ? `grey--text text--lighten-1` : (selectedProvider === str.key ? `blue--text ` : ``)') {{ str.description }}
                v-list-tile-avatar(v-if='selectedProvider === str.key')
                  v-icon.animated.fadeInLeft(color='primary') arrow_forward_ios
              v-divider(v-if='idx < providers.length - 1')

      v-flex(xs12, lg9)

        v-card.wiki-form.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, flat, dark)
            .subheading {{provider.title}}
          v-card-text
            v-form
              .analytic-provider-logo
                img(:src='provider.logo', :alt='provider.title')
              .caption.pt-3 {{provider.description}}
              .caption.pb-3: a(:href='provider.website') {{provider.website}}
              v-divider.mt-3
              v-subheader.pl-0 {{$t('admin:analytics.providerConfiguration')}}
              .body-1.ml-3(v-if='!provider.config || provider.config.length < 1'): em {{$t('admin:analytics.providerNoConfiguration')}}
              template(v-else, v-for='cfg in provider.config')
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

import providersQuery from 'gql/admin/analytics/analytics-query-providers.gql'
import providersSaveMutation from 'gql/admin/analytics/analytics-mutation-save-providers.gql'

export default {
  data() {
    return {
      providers: [],
      selectedProvider: '',
      provider: {}
    }
  },
  watch: {
    selectedProvider(newValue, oldValue) {
      this.provider = _.find(this.providers, ['key', newValue]) || {}
    },
    providers(newValue, oldValue) {
      this.selectedProvider = 'google'
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.providers.refetch()
      this.$store.commit('showNotification', {
        message: this.$t('admin:analytics.refreshSuccess'),
        style: 'success',
        icon: 'cached'
      })
    },
    async save() {
      this.$store.commit(`loadingStart`, 'admin-analytics-saveproviders')
      try {
        await this.$apollo.mutate({
          mutation: providersSaveMutation,
          variables: {
            providers: this.providers.map(str => _.pick(str, [
              'isEnabled',
              'key',
              'config'
            ])).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.stringify({ v: cfg.value.value })}))}))
          }
        })
        this.$store.commit('showNotification', {
          message: this.$t('admin:analytics.saveSuccess'),
          style: 'success',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-analytics-saveproviders')
    }
  },
  apollo: {
    providers: {
      query: providersQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.analytics.providers).map(str => ({
        ...str,
        config: _.sortBy(str.config.map(cfg => ({
          ...cfg,
          value: JSON.parse(cfg.value)
        })), [t => t.value.order])
      })),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-analytics-refresh')
      }
    }
  }
}
</script>

<style lang='scss' scoped>

.analytic-provider-logo {
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
