<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          v-icon.animated.fadeInUp(color='primary', size='80') mdi-swap-horizontal
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft Page Navigation
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Arrow-box prev/next navigation for tagged page series
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s.mr-3(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subtitle-1 Module
          v-list(two-line, dense).py-0
            template(v-for='(item, idx) in providers')
              v-list-item(:key='item.key', @click='selectedProvider = item.key', :disabled='!item.isAvailable')
                v-list-item-avatar(size='24')
                  v-icon(color='grey', v-if='!item.isAvailable') mdi-minus-box-outline
                  v-icon(color='primary', v-else-if='item.isEnabled', v-ripple, @click='item.isEnabled = false') mdi-checkbox-marked-outline
                  v-icon(color='grey', v-else, v-ripple, @click='item.isEnabled = true') mdi-checkbox-blank-outline
                v-list-item-content
                  v-list-item-title.body-2(:class='!item.isAvailable ? `grey--text` : (selectedProvider === item.key ? `primary--text` : ``)') {{ item.title }}
                  v-list-item-subtitle: .caption(:class='!item.isAvailable ? `grey--text text--lighten-1` : (selectedProvider === item.key ? `blue--text ` : ``)') {{ item.description }}
                v-list-item-avatar(v-if='selectedProvider === item.key', size='24')
                  v-icon.animated.fadeInLeft(color='primary', large) mdi-chevron-right
              v-divider(v-if='idx < providers.length - 1')

      v-flex(xs12, lg9)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, flat, dark)
            .subtitle-1 {{provider.title}}
            v-spacer
            v-switch(
              dark
              color='blue lighten-5'
              label='Active'
              v-model='provider.isEnabled'
              hide-details
              inset
              )
          v-card-info(color='blue')
            div
              div {{provider.description}}
              span.caption(v-if='provider.website'): a(:href='provider.website') {{provider.website}}
            v-spacer
            .admin-providerlogo(v-if='provider.logo')
              img(:src='provider.logo', :alt='provider.title')
          v-card-text
            v-form
              .overline.pb-5 Configuration
              .body-1.ml-3(v-if='!provider.config || provider.config.length < 1'): em No configuration options available.
              template(v-else, v-for='cfg in provider.config')
                v-text-field(
                  outlined
                  :key='cfg.key'
                  :label='cfg.value.title'
                  v-model='cfg.value.value'
                  prepend-icon='mdi-cog-box'
                  :hint='cfg.value.hint ? cfg.value.hint : ""'
                  persistent-hint
                  :class='cfg.value.hint ? "mb-2" : ""'
                  )
            v-alert.mt-4(outlined, type='info', dense, icon='mdi-information-outline')
              | Pages need a tag like <code>from:Series Name</code> to show navigation.
              | Also enable <strong>Page Navigation</strong> under Admin → General → Features.
</template>

<script>
import _ from 'lodash'

import providersQuery from 'gql/admin/page-navigation/page-navigation-query-providers.gql'
import providersSaveMutation from 'gql/admin/page-navigation/page-navigation-mutation-save-providers.gql'

export default {
  data () {
    return {
      providers: [],
      selectedProvider: 'page_navigation',
      provider: {}
    }
  },
  watch: {
    selectedProvider (newValue) {
      this.provider = _.find(this.providers, ['key', newValue]) || {}
    },
    providers (newValue) {
      if (newValue.length && !this.selectedProvider) {
        this.selectedProvider = newValue[0].key
      }
      this.provider = _.find(newValue, ['key', this.selectedProvider]) || newValue[0] || {}
    }
  },
  methods: {
    async refresh () {
      await this.$apollo.queries.providers.refetch()
      this.$store.commit('showNotification', {
        message: 'Page navigation configuration refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    async save () {
      this.$store.commit('loadingStart', 'admin-page-navigation-save')
      try {
        const resp = await this.$apollo.mutate({
          mutation: providersSaveMutation,
          variables: {
            providers: this.providers.map(str => _.pick(str, [
              'isEnabled',
              'key',
              'config'
            ])).map(str => ({ ...str, config: str.config.map(cfg => ({ ...cfg, value: JSON.stringify({ v: cfg.value.value }) })) }))
          }
        })
        if (_.get(resp, 'data.pageNavigation.updateProviders.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            message: 'Page navigation configuration saved.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(_.get(resp, 'data.pageNavigation.updateProviders.responseResult.message', 'Unexpected error'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit('loadingStop', 'admin-page-navigation-save')
    }
  },
  apollo: {
    providers: {
      query: providersQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.pageNavigation.providers).map(str => ({
        ...str,
        config: _.sortBy(str.config.map(cfg => ({
          ...cfg,
          value: JSON.parse(cfg.value)
        })), [t => t.value.order])
      })),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-page-navigation-refresh')
      }
    }
  }
}
</script>
