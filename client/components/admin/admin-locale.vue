<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-globe-earth.svg', alt='Locale', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:locale.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:locale.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p3s(icon, outlined, color='grey', href='https://docs.requarks.io/locales', target='_blank')
            v-icon mdi-help-circle
          v-btn.animated.fadeInDown.ml-3(color='success', depressed, @click='save', large, :loading='loading')
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(xl6 lg5 xs12)
              v-card.wiki-form.animated.fadeInUp
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:locale.settings') }}
                v-card-text
                  v-select(
                    outlined
                    :items='installedLocales'
                    prepend-icon='mdi-web'
                    v-model='selectedLocale'
                    item-value='code'
                    item-text='nativeName'
                    :label='namespacing ? $t("admin:locale.base.labelWithNS") : $t("admin:locale.base.label")'
                    persistent-hint
                    :hint='$t("admin:locale.base.hint")'
                  )
                    template(slot='item', slot-scope='data')
                      template(v-if='typeof data.item !== "object"')
                        v-list-item-content(v-text='data.item')
                      template(v-else)
                        v-list-item-avatar
                          v-avatar.blue.white--text(tile, size='40', v-html='data.item.code.toUpperCase()')
                        v-list-item-content
                          v-list-item-title(v-html='data.item.name')
                          v-list-item-subtitle(v-html='data.item.nativeName')
                  v-divider.mt-3
                  v-switch(
                    inset
                    v-model='autoUpdate'
                    :label='$t("admin:locale.autoUpdate.label")'
                    color='primary'
                    persistent-hint
                    :hint='namespacing ? $t("admin:locale.autoUpdate.hintWithNS") : $t("admin:locale.autoUpdate.hint")'
                  )

              v-card.wiki-form.mt-3.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:locale.namespacing') }}
                v-card-text
                  v-switch(
                    inset
                    v-model='namespacing'
                    :label='$t("admin:locale.namespaces.label")'
                    color='primary'
                    persistent-hint
                    :hint='$t("admin:locale.namespaces.hint")'
                    )
                  v-alert.mt-3(
                    outlined
                    color='orange'
                    :value='true'
                    icon='mdi-alert'
                    )
                    span {{ $t('admin:locale.namespacingPrefixWarning.title', { langCode: selectedLocale }) }}
                    .caption.grey--text {{ $t('admin:locale.namespacingPrefixWarning.subtitle') }}
                  v-divider.mt-3.mb-4
                  v-select(
                    outlined
                    :disabled='!namespacing'
                    :items='installedLocales'
                    prepend-icon='mdi-web'
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
                        v-list-item-content(v-text='data.item')
                      template(v-else)
                        v-list-item-avatar
                          v-avatar.blue.white--text(tile, size='40', v-html='data.item.code.toUpperCase()')
                        v-list-item-content
                          v-list-item-title(v-html='data.item.name')
                          v-list-item-subtitle(v-html='data.item.nativeName')
                        v-list-item-action
                          v-checkbox(:input-value='data.attrs.inputValue', color='primary', value)
            v-flex(xl6 lg7 xs12)
              v-card.animated.fadeInUp.wait-p4s
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:locale.downloadTitle') }}
                v-data-table(
                  :headers='headers',
                  :items='locales',
                  hide-default-footer,
                  item-key='code',
                  :items-per-page='1000'
                  )
                  template(v-slot:item.code='{ item }')
                    v-chip.white--text(label, color='teal', small) {{item.code}}
                  template(v-slot:item.name='{ item }')
                    strong {{item.name}}
                  template(v-slot:item.isRTL='{ item }')
                    v-icon(v-if='item.isRTL') mdi-check
                  template(v-slot:item.availability='{ item }')
                    .d-flex.align-center.pl-4
                      v-progress-circular(:value='item.availability', width='2', size='20', :color='item.availability <= 33 ? `red` : (item.availability <= 66) ? `orange` : `green`')
                      .caption.mx-2(:class='item.availability <= 33 ? `red--text` : (item.availability <= 66) ? `orange--text` : `green--text`') {{item.availability}}%
                  template(v-slot:item.isInstalled='{ item }')
                    v-progress-circular(v-if='item.isDownloading', indeterminate, color='blue', size='20', :width='2')
                    v-btn(v-else-if='item.isInstalled && item.installDate < item.updatedAt', icon, small, @click='download(item)')
                      v-icon.blue--text mdi-cached
                    v-btn(v-else-if='item.isInstalled', icon, small, @click='download(item)')
                      v-icon.green--text mdi-check-bold
                    v-btn(v-else, icon, small, @click='download(item)')
                      v-icon.grey--text mdi-cloud-download
              v-card.wiki-form.mt-3.animated.fadeInUp.wait-p5s
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:locale.sideload') }}
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
    },
    headers() {
      return [
        {
          text: this.$t('admin:locale.code'),
          align: 'left',
          value: 'code',
          width: 90
        },
        {
          text: this.$t('admin:locale.name'),
          align: 'left',
          value: 'name'
        },
        {
          text: this.$t('admin:locale.nativeName'),
          align: 'left',
          value: 'nativeName'
        },
        {
          text: this.$t('admin:locale.rtl'),
          align: 'center',
          value: 'isRTL',
          sortable: false,
          width: 10
        },
        {
          text: this.$t('admin:locale.availability'),
          align: 'center',
          value: 'availability',
          sortable: false,
          width: 120
        },
        {
          text: this.$t('admin:locale.download'),
          align: 'center',
          value: 'isInstalled',
          sortable: false,
          width: 100
        }
      ]
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
        lc.updatedAt = new Date().toISOString()
        lc.installDate = lc.updatedAt
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

        _.delay(() => {
          window.location.reload(true)
        }, 1000)
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
