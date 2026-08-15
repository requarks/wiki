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
                v-card-text
                  v-select(
                    :items='tocPositions'
                    outlined
                    prepend-icon='mdi-border-vertical'
                    v-model='config.tocPosition'
                    label='Table of Contents Position'
                    persistent-hint
                    hint='Select whether the table of contents is shown on the left, right or not at all.'
                    )

              v-card.mt-3.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 Custom Fonts
                v-card-text
                  .caption.grey--text.mb-3 Upload font files (.ttf, .otf, .woff, .woff2). @font-face rules are generated automatically and injected on every page.
                  v-data-table(
                    :headers='fontHeaders'
                    :items='config.customFonts'
                    hide-default-footer
                    :items-per-page='100'
                    no-data-text='No custom fonts uploaded yet.'
                    )
                    template(v-slot:item.actions='{ item }')
                      v-btn(icon, small, @click='removeFont(item)')
                        v-icon.red--text mdi-delete
                  v-btn.mt-3(color='primary', depressed, @click='openFontDialog')
                    v-icon(left) mdi-upload
                    span Add Font
                  v-textarea.is-monospaced.mt-4(
                    :value='generatedFontCSS'
                    label='Generated @font-face CSS'
                    outlined
                    readonly
                    auto-grow
                    rows='3'
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
    v-dialog(v-model='fontDialog', max-width='600', persistent)
      v-card
        v-card-title Add Custom Font
        v-card-text
          v-file-input(
            v-model='fontUploadFile'
            label='Font file'
            accept='.ttf,.otf,.woff,.woff2'
            prepend-icon='mdi-file-font'
            show-size
            outlined
            )
          v-text-field(
            v-model='fontForm.family'
            label='Font family name (CSS)'
            hint='e.g. solaimanlipi — letters, numbers, underscore, hyphen only'
            persistent-hint
            outlined
            )
          v-text-field(
            v-model.number='fontForm.weight'
            label='Font weight'
            type='number'
            outlined
            )
          v-select(
            v-model='fontForm.style'
            :items='fontStyles'
            label='Font style'
            outlined
            )
          v-textarea.is-monospaced(
            v-model='fontForm.unicodeRange'
            label='Unicode range (optional)'
            hint='Comma-separated ranges, e.g. U+0980-09FF or U+0600-06FF,U+0750-077F,U+08A0-08FF'
            persistent-hint
            outlined
            auto-grow
            rows='2'
            )
          .caption.grey--text.mt-2.mb-1 Quick presets:
          v-chip.mr-1.mb-1(
            v-for='preset in unicodeRangePresets'
            :key='preset.label'
            small
            label
            color='primary'
            outlined
            @click='fontForm.unicodeRange = preset.value'
            ) {{ preset.label }}
        v-card-actions
          v-spacer
          v-btn(text, @click='closeFontDialog') Cancel
          v-btn(color='primary', depressed, :loading='fontUploading', @click='uploadFont') Upload
</template>

<script>
import _ from 'lodash'
import Cookies from 'js-cookie'
import { sync } from 'vuex-pathify'

import themeConfigQuery from 'gql/admin/theme/theme-query-config.gql'
import themeSaveMutation from 'gql/admin/theme/theme-mutation-save.gql'

export default {
  data() {
    return {
      loading: false,
      fontDialog: false,
      fontUploading: false,
      fontUploadFile: null,
      fontForm: {
        family: '',
        weight: 400,
        style: 'normal',
        unicodeRange: ''
      },
      fontStyles: ['normal', 'italic', 'oblique'],
      unicodeRangePresets: [
        { label: 'Bengali', value: 'U+0980-09FF' },
        { label: 'Arabic script', value: 'U+0600-06FF,U+0750-077F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF,U+10E60-10E7F' }
      ],
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
        tocPosition: 'left',
        injectCSS: '',
        injectHead: '',
        injectBody: '',
        customFonts: []
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
    },
    tocPositions () {
      return [
        { text: 'Left (default)', value: 'left' },
        { text: 'Right', value: 'right' },
        { text: 'Hidden', value: 'off' }
      ]
    },
    fontHeaders () {
      return [
        { text: 'Family', value: 'family' },
        { text: 'File', value: 'filename' },
        { text: 'Weight', value: 'weight', width: 90 },
        { text: 'Style', value: 'style', width: 90 },
        { text: 'Unicode Range', value: 'unicodeRange' },
        { text: '', value: 'actions', sortable: false, width: 60, align: 'right' }
      ]
    },
    generatedFontCSS () {
      return this.buildFontCSS(this.config.customFonts || [])
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
    normalizeUnicodeRange (value) {
      if (!value || !String(value).trim()) {
        return ''
      }
      return String(value)
        .split(',')
        .map(part => part.trim().toUpperCase())
        .filter(Boolean)
        .join(',')
    },
    buildFontCSS (fonts) {
      const normalized = (fonts || []).filter(font => font && font.family && font.filename && font.format)
      if (normalized.length < 1) {
        return ''
      }

      const faceRules = normalized.map(font => {
        const lines = [
          '@font-face {',
          `  font-family: ${font.family};`,
          `  src: url('/_custom/fonts/${encodeURIComponent(font.filename)}') format('${font.format}');`,
          `  font-weight: ${font.weight || 400};`,
          `  font-style: ${font.style || 'normal'};`
        ]
        if (font.unicodeRange) {
          lines.push(`  unicode-range: ${font.unicodeRange};`)
        }
        lines.push('}')
        return lines.join('\n')
      }).join('\n')

      const stack = `${[...new Set(normalized.map(font => font.family))].join(', ')}, sans-serif`
      const importantSelectors = [
        '.v-main .page-header-block .headline',
        '.v-main .page-header-block .caption',
        '.v-main .page-col-sd .overline',
        '.v-main .page-col-sd .v-list-item__title',
        '.v-main .page-col-sd .v-chip__content',
        '.v-main .page-col-sd .v-chip__content span',
        '.v-main .page-col-sd .body-2',
        '.v-main .page-col-sd .caption',
        '.v-main .page-col-sd .page-author-card-name',
        '.v-main .page-col-sd .page-author-card-date',
        '.v-main #arrow-boxes',
        '.v-main #arrow-boxes .circle',
        '.v-main #arrow-boxes .arrow-left',
        '.v-main #arrow-boxes .arrow-right',
        '.v-main .related-posts .post-card',
        '.v-main .related-posts .post-card h3',
        '.v-main .related-posts .post-card p'
      ]

      const applyRule = [
        '.v-main .contents {',
        `  font-family: ${stack};`,
        '}',
        '',
        `${importantSelectors.join(',\n')} {`,
        `  font-family: ${stack} !important;`,
        '}'
      ].join('\n')

      return `${faceRules}\n\n${applyRule}`
    },
    openFontDialog () {
      this.fontForm = {
        family: '',
        weight: 400,
        style: 'normal',
        unicodeRange: ''
      }
      this.fontUploadFile = null
      this.fontDialog = true
    },
    closeFontDialog () {
      this.fontDialog = false
      this.fontUploadFile = null
    },
    async uploadFont () {
      if (!this.fontUploadFile) {
        this.$store.commit('showNotification', {
          message: 'Choose a font file to upload.',
          style: 'red',
          icon: 'alert'
        })
        return
      }
      if (!this.fontForm.family || !/^[a-zA-Z0-9_-]+$/.test(this.fontForm.family)) {
        this.$store.commit('showNotification', {
          message: 'Enter a valid font family name (letters, numbers, underscore, hyphen only).',
          style: 'red',
          icon: 'alert'
        })
        return
      }

      this.fontUploading = true
      try {
        const formData = new FormData()
        formData.append('fontUpload', this.fontUploadFile)
        formData.append('fontMetadata', JSON.stringify({
          family: this.fontForm.family,
          weight: this.fontForm.weight || 400,
          style: this.fontForm.style || 'normal',
          unicodeRange: this.normalizeUnicodeRange(this.fontForm.unicodeRange)
        }))

        const jwtToken = Cookies.get('jwt')
        const resp = await fetch('/u/fonts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwtToken}`
          },
          body: formData
        })
        const result = await resp.json()
        if (!resp.ok || !result.succeeded) {
          throw new Error(result.message || 'Font upload failed.')
        }

        if (!this.config.customFonts) {
          this.$set(this.config, 'customFonts', [])
        }
        this.config.customFonts.push(result.font)
        this.closeFontDialog()
        this.$store.commit('showNotification', {
          message: 'Font uploaded. Click Apply to save changes.',
          style: 'success',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'red',
          icon: 'alert'
        })
      }
      this.fontUploading = false
    },
    async removeFont (font) {
      if (!confirm(`Remove font "${font.family}"?`)) {
        return
      }

      this.config.customFonts = this.config.customFonts.filter(item => item.id !== font.id)
      this.$store.commit('showNotification', {
        message: 'Font removed. Click Apply to save changes.',
        style: 'success',
        icon: 'check'
      })
    },
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
            tocPosition: this.config.tocPosition,
            injectCSS: this.config.injectCSS,
            injectHead: this.config.injectHead,
            injectBody: this.config.injectBody,
            customFonts: this.config.customFonts || []
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
      update: (data) => ({
        ...data.theming.config,
        customFonts: data.theming.config.customFonts || []
      }),
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
