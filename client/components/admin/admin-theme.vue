<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-paint-palette.svg', alt='Theme', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Theme
            .subheading.grey--text Modify the look &amp; feel of your wiki
          v-spacer
          v-btn(color='success', depressed, @click='save', large, :loading='loading')
            v-icon(left) check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card.wiki-form
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Theme
                v-card-text
                  v-select(
                    :items='themes'
                    outline
                    background-color='grey lighten-2'
                    prepend-icon='palette'
                    v-model='config.theme'
                    label='Site Theme'
                    persistent-hint
                    hint='Themes affect how content pages are displayed. Other site sections (such as the editor or admin area) are not affected.'
                    )
                    template(slot='item', slot-scope='data')
                      v-list-tile-avatar
                        v-icon.blue--text(dark) filter_frames
                      v-list-tile-content
                        v-list-tile-title(v-html='data.item.text')
                        v-list-tile-sub-title(v-html='data.item.author')
                  v-divider.mt-3
                  v-switch(
                    v-model='darkMode'
                    label='Dark Mode'
                    color='primary'
                    persistent-hint
                    hint='Not recommended for accessibility. May not be supported by all themes.'
                    )
              v-card.wiki-form.mt-3
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Code Injection
                v-card-text
                  v-textarea(
                    v-model='config.injectCSS'
                    label='CSS Override'
                    outline
                    background-color='grey lighten-1'
                    color='primary'
                    persistent-hint
                    hint='CSS code to inject after system default CSS. Consider using custom themes if you have a large amount of css code. Injecting too much CSS code will result in poor page load performance! CSS will automatically be minified.'
                    auto-grow
                    )
                  v-textarea.mt-2(
                    v-model='config.injectHead'
                    label='Head HTML Injection'
                    outline
                    background-color='grey lighten-1'
                    color='primary'
                    persistent-hint
                    hint='HTML code to be injected just before the closing head tag. Usually for script tags.'
                    auto-grow
                    )
                  v-textarea.mt-2(
                    v-model='config.injectBody'
                    label='Body HTML Injection'
                    outline
                    background-color='grey lighten-1'
                    color='primary'
                    persistent-hint
                    hint='HTML code to be injected just before the closing body tag.'
                    auto-grow
                    )
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title
                    .subheading Download Themes
                  v-spacer
                  v-chip(label, color='white', small).teal--text coming soon
                v-card-text.caption -- Coming soon --
</template>

<script>
import _ from 'lodash'
import { sync } from 'vuex-pathify'

import themeConfigQuery from 'gql/admin/theme/theme-query-config.gql'
import themeSaveMutation from 'gql/admin/theme/theme-mutation-save.gql'

export default {
  data() {
    return {
      loading: false,
      themes: [
        { text: 'Default', author: 'requarks.io', value: 'default' }
      ],
      config: {
        theme: 'default',
        darkMode: false,
        injectCSS: '',
        injectHead: '',
        injectBody: ''
      },
      darkModeInitial: false
    }
  },
  computed: {
    darkMode: sync('site/dark')
  },
  mounted() {
    this.darkModeInitial = this.darkMode
  },
  beforeDestroy() {
    this.darkMode = this.darkModeInitial
  },
  methods: {
    async save () {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-theme-save')
      try {
        const respRaw = await this.$apollo.mutate({
          mutation: themeSaveMutation,
          variables: {
            theme: this.config.theme,
            darkMode: this.darkMode,
            injectCSS: this.config.injectCSS,
            injectHead: this.config.injectHead,
            injectBody: this.config.injectBody
          }
        })
        const resp = _.get(respRaw, 'data.theming.setConfig.responseResult', {})
        if (resp.succeeded) {
          this.darkModeInitial = this.darkMode
          this.$store.commit('showNotification', {
            message: 'Theme settings updated successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-theme-save')
      this.loading = false
    }
  },
  apollo: {
    config: {
      query: themeConfigQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.theming.config,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-theme-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
