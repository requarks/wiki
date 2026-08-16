<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          v-icon.animated.fadeInUp(color='primary', size='80') mdi-tune
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft Page Customization
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Page navigation, embeds, and comments settings
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
                div.page-customization-field(
                  v-if='shouldShowConfigField(cfg)'
                  :key='cfg.key'
                  :class='{ "page-customization-field--hint": cfg.value.hint }'
                  )
                  v-switch(
                    v-if='cfg.value.type === "boolean"'
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
                    :label='cfg.value.title'
                    v-model='cfg.value.value'
                    prepend-icon='mdi-cog-box'
                    :hint='cfg.value.hint ? cfg.value.hint : ""'
                    persistent-hint
                    auto-grow
                    rows='3'
                    )
                  v-text-field(
                    v-else-if='cfg.value.type === "number" || cfg.value.type === "Number"'
                    outlined
                    type='number'
                    :label='cfg.value.title'
                    v-model.number='cfg.value.value'
                    prepend-icon='mdi-cog-box'
                    :hint='cfg.value.hint ? cfg.value.hint : ""'
                    persistent-hint
                    )
                  v-text-field(
                    v-else
                    outlined
                    :label='cfg.value.title'
                    v-model='cfg.value.value'
                    prepend-icon='mdi-cog-box'
                    :hint='cfg.value.hint ? cfg.value.hint : ""'
                    persistent-hint
                    )
            v-alert.mt-4(v-if='provider.key === "page_navigation"', outlined, type='info', dense, icon='mdi-information-outline')
              div The <strong>সূচী</strong> button and <strong>prev/next arrows</strong> appear when the page group regex matches:
              ul.mt-2.mb-0
                li Use <code>|</code> for alternates (default <code>^from:.+|^download$|^up:কিতাব$</code>).
                li <code>^from:…</code> alternates match alone — series pages sharing that tag.
                li All other alternates must match together — e.g. <code>^download$</code> and <code>^up:কিতাব$</code>.
              div.mt-2 Use <code>nav:off</code> on a page to hide arrows. Enable <strong>Page Customization</strong> under Admin → General → Features.
            v-alert.mt-4(v-else-if='provider.key === "related_pages"', outlined, type='info', dense, icon='mdi-information-outline')
              div <strong>Related page cards</strong> show upcoming pages from the same tagged series below the navigation area.
              ul.mt-2.mb-0
                li With <strong>Reuse page navigation group</strong> on (default), related cards use the Page Navigation regex and share one database query per page.
                li Turn reuse off to configure a separate page group regex and disable tag for related cards only.
                li Configure how many cards to show and the image base URL.
            v-alert.mt-4(v-else-if='provider.key === "iframe_embed"', outlined, type='info', dense, icon='mdi-information-outline')
              div <strong>Iframe embed heights</strong> apply to Google Drive and archive preview iframes on pages that include embed tags.
              ul.mt-2.mb-0
                li Desktop settings apply from the <code>md</code> breakpoint up (960px and wider).
                li Mobile settings apply on phones and small tablets; the smaller of px and vh caps is used.
                li Disable this module to fall back to built-in defaults in the component.
            v-alert.mt-4(v-else-if='provider.key === "telegram_comments"', outlined, type='info', dense, icon='mdi-information-outline')
              div The <strong>Telegram comment box</strong> (Comments.app) appears below page content when enabled.
              ul.mt-2.mb-0
                li Set the Comments.app website ID, or leave empty to disable.
                li Optional page group regex limits which tagged pages show the widget; leave empty for all pages.
              div.mt-2 Comments.app requires your production domain — it does not work on localhost.
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
    shouldShowConfigField (cfg) {
      if (this.provider.key !== 'related_pages') {
        return true
      }
      if (cfg.key === 'reuseNavigationGroup') {
        return true
      }
      const reuseCfg = _.find(this.provider.config, ['key', 'reuseNavigationGroup'])
      const reuseEnabled = reuseCfg ? reuseCfg.value.value !== false : true
      if (reuseEnabled && (cfg.key === 'pageGroupTagRegex' || cfg.key === 'disableNavTag')) {
        return false
      }
      return true
    },
    async refresh () {
      await this.$apollo.queries.providers.refetch()
      this.$store.commit('showNotification', {
        message: 'Page customization configuration refreshed.',
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
            message: 'Page customization configuration saved.',
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
        })), [t => t.value.order, t => t.key])
      })).sort((a, b) => {
        const order = { page_navigation: 1, related_pages: 2, iframe_embed: 3, telegram_comments: 4 }
        return (order[a.key] || 100) - (order[b.key] || 100)
      }),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-page-navigation-refresh')
      }
    }
  }
}
</script>

<style lang="scss">
.page-customization-field {
  margin-bottom: 8px;
}

.page-customization-field--hint {
  margin-bottom: 36px;
}
</style>
