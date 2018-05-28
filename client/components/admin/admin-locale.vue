<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text Locale
        .subheading.grey--text Set localization options for your wiki
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Locale Settings
                v-card-text
                  v-select(
                    :items='installedLocales'
                    prepend-icon='language'
                    v-model='selectedLocale'
                    item-value='code'
                    item-text='name'
                    :label='namespacing ? "Base Locale" : "Site Locale"'
                    persistent-hint
                    hint='All UI text elements will be displayed in selected language.'
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
                  v-divider
                  v-switch(
                    v-model='autoUpdate'
                    label='Update Automatically'
                    color='primary'
                    persistent-hint
                    :hint='namespacing ? "Automatically download updates to all namespaced locales enabled below." : "Automatically download updates to this locale as they become available."'
                  )
                v-divider.my-0
                v-card-actions.grey.lighten-4
                  v-spacer
                  v-btn(color='primary', :loading='loading', @click='save')
                    v-icon(left) chevron_right
                    span Save

              v-card.mt-3
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Multilingual Namespacing
                v-card-text
                  v-switch(
                    v-model='namespacing'
                    label='Multilingual Namespaces'
                    color='primary'
                    persistent-hint
                    hint='Enables multiple language versions of the same page.'
                    )
                  v-alert.mt-3(
                    outline
                    color='orange'
                    :value='true'
                    icon='warning'
                    )
                    span The locale code will be prefixed to all paths. (e.g. /{{ selectedLocale }}/page-name)
                    .caption.grey--text Paths without a locale code will be automatically redirected to the base locale defined above.
                  v-divider
                  v-select(
                    :disabled='!namespacing'
                    :items='installedLocales'
                    prepend-icon='language'
                    multiple
                    chips
                    deletable-chips
                    v-model='namespaces'
                    item-value='code'
                    item-text='name'
                    label='Active Namespaces'
                    persistent-hint
                    hint='List of locales enabled for multilingual namespacing. The base locale defined above will always be included regardless of this selection.'
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
                v-divider.my-0
                v-card-actions.grey.lighten-4
                  v-spacer
                  v-btn(color='primary', :loading='loading', @click='save')
                    v-icon(left) chevron_right
                    span Save
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title
                    .subheading Download Locale
                v-list(two-line, dense)
                  template(v-for='(lc, idx) in locales')
                    v-list-tile(:key='lc.code')
                      v-list-tile-avatar
                        v-avatar.teal.white--text(size='40') {{lc.code.toUpperCase()}}
                      v-list-tile-content
                        v-list-tile-title(v-html='lc.name')
                        v-list-tile-sub-title(v-html='lc.nativeName')
                      v-list-tile-action(v-if='lc.isRTL')
                        v-chip(label, small).caption.grey--text.text--darken-2 RTL
                      v-list-tile-action(v-if='lc.isInstalled && lc.installDate < lc.updatedAt', @click='download(lc.code)')
                        v-icon.blue--text cached
                      v-list-tile-action(v-else-if='lc.isInstalled')
                        v-icon.green--text check
                      v-list-tile-action(v-else-if='lc.isDownloading')
                        v-progress-circular(indeterminate, color='blue', size='20', :width='3')
                      v-list-tile-action(v-else)
                        v-btn(icon, @click='download(lc)')
                          v-icon.grey--text cloud_download
                    v-divider.my-0(inset, v-if='idx < locales.length - 1')
</template>

<script>
import _ from 'lodash'

import localesQuery from 'gql/admin-locale-query-list.gql'
import localesDownloadMutation from 'gql/admin-locale-mutation-download.gql'
import localesSaveMutation from 'gql/admin-locale-mutation-save.gql'

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
