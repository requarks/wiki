<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-globe-earth.svg', alt='Locale', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:locale.title') }}
            .subheading.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:locale.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='save', large, :loading='loading')
            v-icon(left) check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card.wiki-form.animated.fadeInUp
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading {{ $t('admin:locale.settings') }}
                v-card-text
                  v-select(
                    outline
                    :items='installedLocales'
                    prepend-icon='language'
                    v-model='selectedLocale'
                    item-value='code'
                    item-text='nativeName'
                    :label='namespacing ? $t("admin:locale.base.labelWithNS") : $t("admin:locale.base.label")'
                    persistent-hint
                    :hint='$t("admin:locale.base.hint")'
                  )
                    template(slot='item', slot-scope='data')
                      template(v-if='typeof data.item !== "object"')
                        v-list-tile-content(v-text='data.item')
                      template(v-else)
                        v-list-tile-avatar
                          v-avatar.blue.white--text(tile, size='40', v-html='data.item.code.toUpperCase()')
                        v-list-tile-content
                          v-list-tile-title(v-html='data.item.name')
                          v-list-tile-sub-title(v-html='data.item.nativeName')
                  v-divider.mt-3
                  v-switch(
                    v-model='autoUpdate'
                    :label='$t("admin:locale.autoUpdate.label")'
                    color='primary'
                    persistent-hint
                    :hint='namespacing ? $t("admin:locale.autoUpdate.hintWithNS") : $t("admin:locale.autoUpdate.hint")'
                  )

              v-card.wiki-form.mt-3.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading {{ $t('admin:locale.namespacing') }}
                  v-spacer
                  v-chip(label, color='white', small).primary--text coming soon
                v-card-text
                  v-switch(
                    v-model='namespacing'
                    :label='$t("admin:locale.namespaces.label")'
                    color='primary'
                    persistent-hint
                    :hint='$t("admin:locale.namespaces.hint")'
                    )
                  v-alert.mt-3(
                    outline
                    color='orange'
                    :value='true'
                    icon='warning'
                    )
                    span {{ $t('admin:locale.namespacingPrefixWarning.title', { langCode: selectedLocale }) }}
                    .caption.grey--text {{ $t('admin:locale.namespacingPrefixWarning.subtitle') }}
                  v-divider.mt-3.mb-4
                  v-select(
                    outline
                    :disabled='!namespacing'
                    :items='installedLocales'
                    prepend-icon='language'
                    multiple
                    chips
                    deletable-chips
                    v-model='namespaces'
                    item-value='code'
                    item-text='name'
                    :label='$t("admin:locale.activeNamespaces.label")'
                    persistent-hint
                    small-chips
                    :hint='$t("admin:locale.activeNamespaces.hint")'
                    )
                    template(slot='item', slot-scope='data')
                      template(v-if='typeof data.item !== "object"')
                        v-list-tile-content(v-text='data.item')
                      template(v-else)
                        v-list-tile-avatar
                          v-avatar.blue.white--text(tile, size='40', v-html='data.item.code.toUpperCase()')
                        v-list-tile-content
                          v-list-tile-title(v-html='data.item.name')
                          v-list-tile-sub-title(v-html='data.item.nativeName')
                        v-list-tile-action
                          v-checkbox(:input-value='data.tile.props.value', color='primary', value)
            v-flex(lg6 xs12)
              v-card.animated.fadeInUp.wait-p4s
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title
                    .subheading {{ $t('admin:locale.download') }}
                v-list(two-line, dense)
                  template(v-for='(lc, idx) in locales')
                    v-list-tile(:key='lc.code')
                      v-list-tile-avatar
                        v-avatar.teal.white--text(size='40') {{lc.code.toUpperCase()}}
                      v-list-tile-content
                        v-list-tile-title(v-html='lc.name')
                        v-list-tile-sub-title(v-html='lc.nativeName')
                      v-list-tile-action(v-if='lc.isRTL')
                        v-chip(label, small, :class='$vuetify.dark ? `text--lighten-5` : `text--darken-2`').caption.grey--text RTL
                      v-list-tile-action(v-if='lc.isInstalled && lc.installDate < lc.updatedAt')
                        v-btn(icon, @click='download(lc)')
                          v-icon.blue--text cached
                      v-list-tile-action(v-else-if='lc.isInstalled')
                        v-icon.green--text check
                      v-list-tile-action(v-else-if='lc.isDownloading')
                        v-progress-circular(indeterminate, color='blue', size='20', :width='3')
                      v-list-tile-action(v-else)
                        v-btn(icon, @click='download(lc)')
                          v-icon.grey--text cloud_download
                    v-divider.my-0(inset, v-if='idx < locales.length - 1')
              v-card.wiki-form.mt-3.animated.fadeInUp.wait-p5s
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title
                    .subheading {{ $t('admin:locale.sideload') }}
                  v-spacer
                  v-chip(label, color='white', small).teal--text coming soon
                v-card-text
                  div {{ $t('admin:locale.sideloadHelp') }}
                  v-btn.ml-0.mt-3(color='teal', disabled) {{ $t('common:actions.browse') }}
</template>

<script>
import _ from 'lodash'

/* global WIKI */

import localesQuery from 'gql/admin/locale/locale-query-list.gql'
import localesDownloadMutation from 'gql/admin/locale/locale-mutation-download.gql'
import localesSaveMutation from 'gql/admin/locale/locale-mutation-save.gql'

export default {
  data() {
    return {
      loading: false,
      locales: [],
      selectedLocale: 'en',
      autoUpdate: false,
      namespacing: false,
      namespaces: []
    }
  },
  computed: {
    installedLocales() {
      return _.filter(this.locales, ['isInstalled', true])
    }
  },
  methods: {
    async download(lc) {
      lc.isDownloading = true
      const respRaw = await this.$apollo.mutate({
        mutation: localesDownloadMutation,
        variables: {
          locale: lc.code
        }
      })
      const resp = _.get(respRaw, 'data.localization.downloadLocale.responseResult', {})
      if (resp.succeeded) {
        lc.isDownloading = false
        lc.isInstalled = true
        this.$store.commit('showNotification', {
          message: `Locale ${lc.name} has been installed successfully.`,
          style: 'success',
          icon: 'get_app'
        })
      } else {
        this.$store.commit('showNotification', {
          message: `Error: ${resp.message}`,
          style: 'error',
          icon: 'warning'
        })
      }
      this.isDownloading = false
    },
    async save() {
      this.loading = true
      const respRaw = await this.$apollo.mutate({
        mutation: localesSaveMutation,
        variables: {
          locale: this.selectedLocale,
          autoUpdate: this.autoUpdate,
          namespacing: this.namespacing,
          namespaces: this.namespaces
        }
      })
      const resp = _.get(respRaw, 'data.localization.updateLocale.responseResult', {})
      if (resp.succeeded) {
        // Change UI language
        WIKI.$i18n.i18next.changeLanguage(this.selectedLocale)
        WIKI.$moment.locale(this.selectedLocale)

        // Check for RTL
        const curLocale = _.find(this.locales, ['code', this.selectedLocale])
        this.$vuetify.rtl = curLocale && curLocale.isRTL

        this.$store.commit('showNotification', {
          message: 'Locale settings updated successfully.',
          style: 'success',
          icon: 'check'
        })
      } else {
        this.$store.commit('showNotification', {
          message: `Error: ${resp.message}`,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    }
  },
  apollo: {
    locales: {
      query: localesQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.localization.locales.map(lc => ({ ...lc, isDownloading: false })),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-locale-refresh')
      }
    },
    selectedLocale: {
      query: localesQuery,
      update: (data) => data.localization.config.locale
    },
    autoUpdate: {
      query: localesQuery,
      update: (data) => data.localization.config.autoUpdate
    },
    namespacing: {
      query: localesQuery,
      update: (data) => data.localization.config.namespacing
    },
    namespaces: {
      query: localesQuery,
      update: (data) => data.localization.config.namespaces
    }
  }
}
</script>
