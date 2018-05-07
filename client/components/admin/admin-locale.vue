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
                v-toolbar(color='grey darken-3', dark, dense, flat)
                  v-toolbar-title
                    .subheading Locale Settings
                v-card-text
                  v-select(:items='installedLocales'
                    prepend-icon='public'
                    v-model='selectedLocale'
                    item-value='code'
                    item-text='name'
                    label='Site Locale'
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
                    hint='Automatically download updates to this locale as they become available.'
                  )
                v-divider
                .px-3.pb-3
                  v-btn(color='primary', :loading='loading', @click='save')
                    v-icon(left) chevron_right
                    span Save
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title
                    .subheading Download Locale
                v-list
                  v-list-tile(v-for='lc in locales')
                    v-list-tile-avatar
                      v-avatar.teal.white--text(tile, size='40') {{lc.code.toUpperCase()}}
                    v-list-tile-content
                      v-list-tile-title(v-html='lc.name')
                      v-list-tile-sub-title(v-html='lc.nativeName')
                    v-list-tile-action(v-if='lc.isInstalled && lc.installDate < lc.updatedAt', @click='download(lc.code)')
                      v-icon.blue--text cached
                    v-list-tile-action(v-else-if='lc.isInstalled')
                      v-icon.green--text check
                    v-list-tile-action(v-else-if='lc.isDownloading')
                      v-progress-circular(indeterminate, color='blue', size='20', :width='3')
                    v-list-tile-action(v-else)
                      v-btn(icon, @click='download(lc)')
                        v-icon.grey--text cloud_download
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
      autoUpdate: false
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
          autoUpdate: this.autoUpdate
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
    }
  }
}
</script>

<style lang='scss'>

</style>
