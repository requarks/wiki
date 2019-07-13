<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-paint-palette.svg', alt='Theme', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:theme.title')}}
            .subheading.grey--text.animated.fadeInLeft.wait-p2s {{$t('admin:theme.subtitle')}}
          v-spacer
          v-btn.animated.fadeInRight(color='success', depressed, @click='save', large, :loading='loading')
            v-icon(left) check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card.wiki-form.animated.fadeInUp
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading {{$t('admin:theme.title')}}
                v-card-text
                  v-select(
                    :items='themes'
                    outline
                    background-color='grey lighten-2'
                    prepend-icon='palette'
                    v-model='config.theme'
                    :label='$t(`admin:theme.siteTheme`)'
                    persistent-hint
                    :hint='$t(`admin:theme.siteThemeHint`)'
                    )
                    template(slot='item', slot-scope='data')
                      v-list-tile-avatar
                        v-icon.blue--text(dark) filter_frames
                      v-list-tile-content
                        v-list-tile-title(v-html='data.item.text')
                        v-list-tile-sub-title(v-html='data.item.author')
                  v-select.mt-3(
                    :items='iconsets'
                    outline
                    background-color='grey lighten-2'
                    prepend-icon='pets'
                    v-model='config.iconset'
                    :label='$t(`admin:theme.iconset`)'
                    persistent-hint
                    :hint='$t(`admin:theme.iconsetHint`)'
                    )
                  v-divider.mt-3
                  v-switch(
                    v-model='darkMode'
                    :label='$t(`admin:theme.darkMode`)'
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.darkModeHint`)'
                    )

              v-card.wiki-form.mt-3.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading {{$t(`admin:theme.codeInjection`)}}
                v-card-text
                  v-textarea(
                    v-model='config.injectCSS'
                    :label='$t(`admin:theme.cssOverride`)'
                    outline
                    background-color='grey lighten-1'
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.cssOverrideHint`)'
                    auto-grow
                    )
                  v-textarea.mt-2(
                    v-model='config.injectHead'
                    :label='$t(`admin:theme.headHtmlInjection`)'
                    outline
                    background-color='grey lighten-1'
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.headHtmlInjectionHint`)'
                    auto-grow
                    )
                  v-textarea.mt-2(
                    v-model='config.injectBody'
                    :label='$t(`admin:theme.bodyHtmlInjection`)'
                    outline
                    background-color='grey lighten-1'
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.bodyHtmlInjectionHint`)'
                    auto-grow
                    )
            v-flex(lg6 xs12)
              v-card.animated.fadeInUp.wait-p2s
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title
                    .subheading {{$t('admin:theme.downloadThemes')}}
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
      iconsets: [
        { text: 'Material Icons (default)', value: 'md' },
        { text: 'Material Design Icons', value: 'mdi' },
        { text: 'Font Awesome 5', value: 'fa' },
        { text: 'Font Awesome 4', value: 'fa4' },
      ],
      config: {
        theme: 'default',
        darkMode: false,
        iconset: '',
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
            iconset: this.config.iconset,
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
