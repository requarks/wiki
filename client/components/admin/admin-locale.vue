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
                  v-btn(color='primary') Save
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
                    v-list-tile-action(v-if='lc.isInstalled && lc.installDate < lc.updatedAt')
                      v-icon.blue--text cached
                    v-list-tile-action(v-else-if='lc.isInstalled')
                      v-icon.green--text check
                    v-list-tile-action(v-else)
                      v-btn(icon, @click='')
                        v-icon.grey--text cloud_download
</template>

<script>
import _ from 'lodash'

import localesQuery from 'gql/admin-locale-query-list.gql'

export default {
  data() {
    return {
      locales: [],
      selectedLocale: 'en',
      autoUpdate: true
    }
  },
  computed: {
    installedLocales() {
      return _.filter(this.locales, ['isInstalled', true])
    }
  },
  apollo: {
    locales: {
      query: localesQuery,
      update: (data) => data.localization.locales,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-locale-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
