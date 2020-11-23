<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-paint-palette.svg', alt='Theme', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:theme.title')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{$t('admin:theme.subtitle')}}
          v-spacer
          v-btn.animated.fadeInRight(color='success', depressed, @click='save', large, :loading='loading')
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card.animated.fadeInUp
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{$t('admin:theme.title')}}
                v-card-text
                  v-select(
                    :items='themes'
                    outlined
                    prepend-icon='mdi-palette'
                    v-model='config.theme'
                    :label='$t(`admin:theme.siteTheme`)'
                    persistent-hint
                    :hint='$t(`admin:theme.siteThemeHint`)'
                    )
                    template(slot='item', slot-scope='data')
                      v-list-item-avatar
                        v-icon.blue--text(dark) mdi-image-filter-frames
                      v-list-item-content
                        v-list-item-title(v-html='data.item.text')
                        v-list-item-sub-title(v-html='data.item.author')
                  v-select.mt-3(
                    :items='iconsets'
                    outlined
                    prepend-icon='mdi-paw'
                    v-model='config.iconset'
                    :label='$t(`admin:theme.iconset`)'
                    persistent-hint
                    :hint='$t(`admin:theme.iconsetHint`)'
                    )
                  v-divider.mt-3
                  v-switch(
                    inset
                    v-model='darkMode'
                    :label='$t(`admin:theme.darkMode`)'
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.darkModeHint`)'
                    )

              v-card.mt-3.animated.fadeInUp.wait-p1s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{$t(`admin:theme.options`)}}
                  v-spacer
                  v-chip(label, color='white', small).primary--text coming soon
                v-card-text
                  v-select(
                    :items='[]'
                    outlined
                    prepend-icon='mdi-border-vertical'
                    v-model='config.iconset'
                    label='Table of Contents Position'
                    persistent-hint
                    hint='Select whether the table of contents is shown on the left, right or not at all.'
                    disabled
                    )

            v-flex(lg6 xs12)
              //- v-card.animated.fadeInUp.wait-p2s
              //-   v-toolbar(color='teal', dark, dense, flat)
              //-     v-toolbar-title.subtitle-1 {{$t('admin:theme.downloadThemes')}}
              //-     v-spacer
              //-     v-chip(label, color='white', small).teal--text coming soon
              //-   v-data-table(
              //-     :headers='headers',
              //-     :items='themes',
              //-     hide-default-footer,
              //-     item-key='value',
              //-     :items-per-page='1000'
              //-   )
              //-     template(v-slot:item='thm')
              //-       td
              //-         strong {{thm.item.text}}
              //-       td
              //-         span {{ thm.item.author }}
              //-       td.text-xs-center
              //-         v-progress-circular(v-if='thm.item.isDownloading', indeterminate, color='blue', size='20', :width='2')
              //-         v-btn(v-else-if='thm.item.isInstalled && thm.item.installDate < thm.item.updatedAt', icon)
              //-           v-icon.blue--text mdi-cached
              //-         v-btn(v-else-if='thm.item.isInstalled', icon)
              //-           v-icon.green--text mdi-check-bold
              //-         v-btn(v-else, icon)
              //-           v-icon.grey--text mdi-cloud-download

              v-card.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{$t(`admin:theme.codeInjection`)}}
                v-card-text
                  v-textarea.is-monospaced(
                    v-model='config.injectCSS'
                    :label='$t(`admin:theme.cssOverride`)'
                    outlined
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.cssOverrideHint`)'
                    auto-grow
                    )
                  i18next.caption.pl-2.ml-1(path='admin:theme.cssOverrideWarning', tag='div')
                    strong.red--text(place='caution') {{$t('admin:theme.cssOverrideWarningCaution')}}
                    code(place='cssClass') .contents
                  v-textarea.is-monospaced.mt-3(
                    v-model='config.injectHead'
                    :label='$t(`admin:theme.headHtmlInjection`)'
                    outlined
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.headHtmlInjectionHint`)'
                    auto-grow
                    )
                  v-textarea.is-monospaced.mt-2(
                    v-model='config.injectBody'
                    :label='$t(`admin:theme.bodyHtmlInjection`)'
                    outlined
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.bodyHtmlInjectionHint`)'
                    auto-grow
                    )
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
        { text: 'Default', author: 'requarks.io', value: 'default', isInstalled: true, installDate: '', updatedAt: '' }
      ],
      iconsets: [
        { text: 'Material Design Icons (default)', value: 'mdi' },
        { text: 'Font Awesome 5', value: 'fa' },
        { text: 'Font Awesome 4', value: 'fa4' }
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
    darkMode: sync('site/dark'),
    headers() {
      return [
        {
          text: this.$t('admin:theme.downloadName'),
          align: 'left',
          value: 'text'
        },
        {
          text: this.$t('admin:theme.downloadAuthor'),
          align: 'left',
          value: 'author'
        },
        {
          text: this.$t('admin:theme.downloadDownload'),
          align: 'center',
          value: 'value',
          sortable: false,
          width: 100
        }
      ]
    }
  },
  watch: {
    'darkMode' (newValue, oldValue) {
      this.$vuetify.theme.dark = newValue
    }
  },
  mounted() {
    this.darkModeInitial = this.darkMode
  },
  beforeDestroy() {
    this.darkMode = this.darkModeInitial
    this.$vuetify.theme.dark = this.darkModeInitial
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
.v-textarea.is-monospaced textarea {
  font-family: 'Roboto Mono', 'Courier New', Courier, monospace;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
</style>
