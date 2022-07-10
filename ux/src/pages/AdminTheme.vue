<template lang='pug'>
q-page.admin-theme
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-paint-roller-animated.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.theme.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.theme.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        type='a'
        href='https://docs.js.wiki/admin/theme'
        target='_blank'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='fa-solid fa-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :loading='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-6
      //- -----------------------
      //- Theme Options
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section.flex.items-center
          .text-subtitle1 {{t('admin.theme.appearance')}}
          q-space
          q-btn.acrylic-btn(
            icon='las la-redo-alt'
            :label='t(`admin.theme.resetDefaults`)'
            flat
            size='sm'
            color='pink'
            @click='resetColors'
          )
        q-item(tag='label')
          blueprint-icon(icon='light-on')
          q-item-section
            q-item-label {{t(`admin.theme.darkMode`)}}
            q-item-label(caption) {{t(`admin.theme.darkModeHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.dark'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.theme.darkMode`)'
              )
        template(v-for='(cl, idx) of colorKeys', :key='cl')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='fill-color')
            q-item-section
              q-item-label {{t(`admin.theme.` + cl + `Color`)}}
              q-item-label(caption) {{t(`admin.theme.` + cl + `ColorHint`)}}
            q-item-section(side)
              .text-caption.text-grey-6 {{state.config[`color` + startCase(cl)]}}
            q-item-section(side)
              q-btn.q-mr-sm(
                :key='`btnpick-` + cl'
                glossy
                padding='xs md'
                no-caps
                size='sm'
                :style='`background-color: ` + state.config[`color` + startCase(cl)] + `;`'
                text-color='white'
                )
                q-icon(name='las la-fill', size='xs', left)
                span Pick...
                q-menu
                  q-color(
                    v-model='state.config[`color` + startCase(cl)]'
                  )

      //- -----------------------
      //- Theme Layout
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.theme.layout')}}
        q-item
          blueprint-icon(icon='width')
          q-item-section
            q-item-label {{t(`admin.theme.contentWidth`)}}
            q-item-label(caption) {{t(`admin.theme.contentWidthHint`)}}
          q-item-section.col-auto
            q-btn-toggle(
              v-model='state.config.contentWidth'
              push
              glossy
              no-caps
              toggle-color='primary'
              :options='widthOptions'
            )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='right-navigation-toolbar')
          q-item-section
            q-item-label {{t(`admin.theme.sidebarPosition`)}}
            q-item-label(caption) {{t(`admin.theme.sidebarPositionHint`)}}
          q-item-section.col-auto
            q-btn-toggle(
              v-model='state.config.sidebarPosition'
              push
              glossy
              no-caps
              toggle-color='primary'
              :options='rightLeftOptions'
            )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='index')
          q-item-section
            q-item-label {{t(`admin.theme.tocPosition`)}}
            q-item-label(caption) {{t(`admin.theme.tocPositionHint`)}}
          q-item-section.col-auto
            q-btn-toggle(
              v-model='state.config.tocPosition'
              push
              glossy
              no-caps
              toggle-color='primary'
              :options='rightLeftOptions'
            )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='share')
          q-item-section
            q-item-label {{t(`admin.theme.showSharingMenu`)}}
            q-item-label(caption) {{t(`admin.theme.showSharingMenuHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.showSharingMenu'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.theme.showSharingMenu`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='print')
          q-item-section
            q-item-label {{t(`admin.theme.showPrintBtn`)}}
            q-item-label(caption) {{t(`admin.theme.showPrintBtnHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.showPrintBtn'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.theme.showPrintBtn`)'
              )

    .col-6
      //- -----------------------
      //- Fonts
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section.flex.items-center
          .text-subtitle1 {{t('admin.theme.fonts')}}
          q-space
          q-btn.acrylic-btn(
            icon='las la-redo-alt'
            :label='t(`admin.theme.resetDefaults`)'
            flat
            size='sm'
            color='pink'
            @click='resetFonts'
          )
        q-item
          blueprint-icon(icon='fonts-app')
          q-item-section
            q-item-label {{t(`admin.theme.baseFont`)}}
            q-item-label(caption) {{t(`admin.theme.baseFontHint`)}}
          q-item-section
            q-select(
              outlined
              v-model='state.config.baseFont'
              :options='fonts'
              emit-value
              map-options
              dense
              :aria-label='t(`admin.theme.baseFont`)'
              )
        q-item
          blueprint-icon(icon='fonts-app')
          q-item-section
            q-item-label {{t(`admin.theme.contentFont`)}}
            q-item-label(caption) {{t(`admin.theme.contentFontHint`)}}
          q-item-section
            q-select(
              outlined
              v-model='state.config.contentFont'
              :options='fonts'
              emit-value
              map-options
              dense
              :aria-label='t(`admin.theme.contentFont`)'
              )

      //- -----------------------
      //- Code Injection
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.theme.codeInjection')}}
        q-item
          blueprint-icon(icon='css')
          q-item-section
            q-item-label {{t(`admin.theme.cssOverride`)}}
            q-item-label(caption) {{t(`admin.theme.cssOverrideHint`)}}
        q-item
          q-item-section
            q-no-ssr(:placeholder='t(`common.loading`)')
              util-code-editor.admin-theme-cm(
                ref='cmCSS'
                v-model='state.config.injectCSS'
                language='css'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='html')
          q-item-section
            q-item-label {{t(`admin.theme.headHtmlInjection`)}}
            q-item-label(caption) {{t(`admin.theme.headHtmlInjectionHint`)}}
        q-item
          q-item-section
            q-no-ssr(:placeholder='t(`common.loading`)')
              util-code-editor.admin-theme-cm(
                ref='cmHead'
                v-model='state.config.injectHead'
                language='html'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='html')
          q-item-section
            q-item-label {{t(`admin.theme.bodyHtmlInjection`)}}
            q-item-label(caption) {{t(`admin.theme.bodyHtmlInjectionHint`)}}
        q-item
          q-item-section
            q-no-ssr(:placeholder='t(`common.loading`)')
              util-code-editor.admin-theme-cm(
                ref='cmBody'
                v-model='state.config.injectBody'
                language='html'
              )
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep, startCase } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { setCssVar, useMeta, useQuasar } from 'quasar'
import { onMounted, reactive, watch } from 'vue'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'

import UtilCodeEditor from '../components/UtilCodeEditor.vue'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.theme.title')
})

// DATA

const state = reactive({
  loading: 0,
  config: {
    dark: false,
    injectCSS: '',
    injectHead: '',
    injectBody: '',
    colorPrimary: '#1976D2',
    colorSecondary: '#02C39A',
    colorAccent: '#f03a47',
    colorHeader: '#000',
    colorSidebar: '#1976D2',
    contentWidth: 'full',
    sidebarPosition: 'left',
    tocPosition: 'right',
    showSharingMenu: true,
    showPrintBtn: true,
    baseFont: '',
    contentFont: ''
  }
})

const colorKeys = [
  'primary',
  'secondary',
  'accent',
  'header',
  'sidebar'
]

const widthOptions = [
  { label: 'Full Width', value: 'full' },
  { label: 'Centered', value: 'centered' }
]

const rightLeftOptions = [
  { label: 'Hide', value: 'off' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' }
]

const fonts = [
  { label: 'Inter', value: 'inter' },
  { label: 'Open Sans', value: 'opensans' },
  { label: 'Montserrat', value: 'montserrat' },
  { label: 'Roboto', value: 'roboto' },
  { label: 'Rubik', value: 'rubik' },
  { label: 'Tajawal', value: 'tajawal' },
  { label: 'User System Defaults', value: 'user' }
]

// WATCHERS

watch(() => adminStore.currentSiteId, (newValue) => {
  load()
})

// METHODS

function resetColors () {
  state.config.dark = false
  state.config.colorPrimary = '#1976D2'
  state.config.colorSecondary = '#02C39A'
  state.config.colorAccent = '#f03a47'
  state.config.colorHeader = '#000'
  state.config.colorSidebar = '#1976D2'
}

function resetFonts () {
  state.config.baseFont = 'roboto'
  state.config.contentFont = 'roboto'
}

async function load () {
  state.loading++
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query fetchThemeConfig (
          $id: UUID!
        ) {
          siteById(
            id: $id
          ) {
            theme {
              baseFont
              contentFont
              colorPrimary
              colorSecondary
              colorAccent
              colorHeader
              colorSidebar
              dark
              injectCSS
              injectHead
              injectBody
              contentWidth
              sidebarPosition
              tocPosition
              showSharingMenu
              showPrintBtn
            }
          }
        }
      `,
      variables: {
        id: adminStore.currentSiteId
      },
      fetchPolicy: 'network-only'
    })
    if (!resp?.data?.siteById?.theme) {
      throw new Error('Failed to fetch theme config.')
    }
    state.config = cloneDeep(resp.data.siteById.theme)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to fetch site theme config'
    })
  }
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading++
  try {
    const patchTheme = {
      dark: state.config.dark,
      colorPrimary: state.config.colorPrimary,
      colorSecondary: state.config.colorSecondary,
      colorAccent: state.config.colorAccent,
      colorHeader: state.config.colorHeader,
      colorSidebar: state.config.colorSidebar,
      injectCSS: state.config.injectCSS,
      injectHead: state.config.injectHead,
      injectBody: state.config.injectBody,
      contentWidth: state.config.contentWidth,
      sidebarPosition: state.config.sidebarPosition,
      tocPosition: state.config.tocPosition,
      showSharingMenu: state.config.showSharingMenu,
      showPrintBtn: state.config.showPrintBtn,
      baseFont: state.config.baseFont,
      contentFont: state.config.contentFont
    }
    const respRaw = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveTheme (
          $id: UUID!
          $patch: SiteUpdateInput!
          ) {
          updateSite (
            id: $id,
            patch: $patch
            ) {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `,
      variables: {
        id: adminStore.currentSiteId,
        patch: {
          theme: patchTheme
        }
      }
    })
    if (respRaw?.data?.updateSite?.operation?.succeeded) {
      if (adminStore.currentSiteId === siteStore.id) {
        siteStore.$patch({
          theme: patchTheme
        })
        $q.dark.set(state.config.dark)
        setCssVar('primary', state.config.colorPrimary)
        setCssVar('secondary', state.config.colorSecondary)
        setCssVar('accent', state.config.colorAccent)
        setCssVar('header', state.config.colorHeader)
        setCssVar('sidebar', state.config.colorSidebar)
      }
      $q.notify({
        type: 'positive',
        message: t('admin.theme.saveSuccess')
      })
    } else {
      throw new Error(respRaw?.data?.updateSite?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save site theme config',
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  if (adminStore.currentSiteId) {
    load()
  }
})

</script>

<style lang='scss'>
.admin-theme-cm {
  border: 1px solid #CCC;
  border-radius: 5px;
  overflow: hidden;

  > .CodeMirror {
    height: 150px;
  }
}
</style>
