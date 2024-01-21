<template lang='pug'>
q-page.admin-system
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-processor.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.system.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.system.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/system/`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='load'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn.acrylic-btn(
        ref='copySysInfoBtn'
        flat
        icon='mdi-clipboard-text-outline'
        label='Copy System Info'
        color='primary'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-6
      //- -----------------------
      //- WIKI.JS
      //- -----------------------
      q-card.q-pb-sm
        q-card-section
          .text-subtitle1 Wiki.js
        q-item
          blueprint-icon(icon='breakable', :hue-rotate='-45')
          q-item-section
            q-item-label {{ t('admin.system.currentVersion') }}
            q-item-label(caption) {{t('admin.system.currentVersionHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ state.info.currentVersion }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='cloud-checked', :hue-rotate='-45')
          q-item-section
            q-item-label {{ t('admin.system.latestVersion') }}
            q-item-label(caption) {{t('admin.system.latestVersionHint')}}
          q-item-section
            .row.q-col-gutter-sm
              .col
                .text-caption.dark-value {{ state.info.latestVersion }}
              .col-auto
                q-btn.acrylic-btn(
                  flat
                  color='purple'
                  @click='checkForUpdates'
                  :label='t(`admin.system.checkUpdate`)'
                )

      //- -----------------------
      //- CLIENT
      //- -----------------------
      q-no-ssr
        q-card.q-mt-md.q-pb-sm
          q-card-section
            .text-subtitle1 {{t('admin.system.client')}}
          q-item
            blueprint-icon(icon='navigation-toolbar-top', :hue-rotate='-45')
            q-item-section
              q-item-label {{t('admin.system.browser')}}
              q-item-label(caption) {{t('admin.system.browserHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientBrowser }}
          q-separator(inset)
          q-item
            blueprint-icon(icon='computer', :hue-rotate='-45')
            q-item-section
              q-item-label {{t('admin.system.clientPlatform')}}
              q-item-label(caption) {{t('admin.system.clientPlatformHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientPlatform }}
          q-separator(inset)
          q-item
            blueprint-icon(icon='translation', :hue-rotate='-45')
            q-item-section
              q-item-label {{t('admin.system.clientLanguage')}}
              q-item-label(caption) {{t('admin.system.clientLanguageHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientLanguage }}
          q-separator(inset)
          q-item
            blueprint-icon(icon='cookies', :hue-rotate='-45')
            q-item-section
              q-item-label {{t('admin.system.clientCookies')}}
              q-item-label(caption) {{t('admin.system.clientCookiesHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientCookies }}
          q-separator(inset)
          q-item
            blueprint-icon(icon='widescreen', :hue-rotate='-45')
            q-item-section
              q-item-label {{t('admin.system.clientViewport')}}
              q-item-label(caption) {{t('admin.system.clientViewportHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientViewport }}

    .col-6
      //- -----------------------
      //- ENGINES
      //- -----------------------
      q-card.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.system.engines')}}
        q-item
          blueprint-icon(icon='nodejs', :hue-rotate='-45')
          q-item-section
            q-item-label Node.js
            q-item-label(caption) {{t('admin.system.nodejsHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ state.info.nodeVersion }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='postgresql', :hue-rotate='-45')
          q-item-section
            q-item-label {{t('admin.system.database')}}
            q-item-label(caption) {{t('admin.system.databaseHint')}}
          q-item-section
            q-item-label.dark-value(caption) PostgreSQL {{dbVersion}}
        q-separator(inset)
        q-item
          blueprint-icon(icon='database', :hue-rotate='-45')
          q-item-section
            q-item-label {{t('admin.system.databaseHost')}}
            q-item-label(caption) {{t('admin.system.databaseHostHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ state.info.dbHost }}

      //- -----------------------
      //- HOST INFORMATION
      //- -----------------------
      q-card.q-mt-md.q-pb-sm
        q-card-section
          .text-subtitle1 {{ t('admin.system.hostInfo') }}
        q-item
          blueprint-icon(:icon='platformLogo', :hue-rotate='-45')
          q-item-section
            q-item-label {{ t('admin.system.os') }}
            q-item-label(caption) {{t('admin.system.osHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ (state.info.platform === 'docker') ? 'Docker Container (Linux)' : state.info.operatingSystem }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='server', :hue-rotate='-45')
          q-item-section
            q-item-label {{ t('admin.system.hostname') }}
            q-item-label(caption) {{t('admin.system.hostnameHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ state.info.hostname }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='processor', :hue-rotate='-45')
          q-item-section
            q-item-label {{ t('admin.system.cpuCores') }}
            q-item-label(caption) {{t('admin.system.cpuCoresHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ state.info.cpuCores }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='memory-slot', :hue-rotate='-45')
          q-item-section
            q-item-label {{ t('admin.system.totalRAM') }}
            q-item-label(caption) {{t('admin.system.totalRAMHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ state.info.ramTotal }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='program', :hue-rotate='-45')
          q-item-section
            q-item-label {{ t('admin.system.workingDirectory') }}
            q-item-label(caption) {{t('admin.system.workingDirectoryHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ state.info.workingDirectory }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='automation', :hue-rotate='-45')
          q-item-section
            q-item-label {{ t('admin.system.configFile') }}
            q-item-label(caption) {{t('admin.system.configFileHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ state.info.configFile }}
</template>

<script setup>
import { cloneDeep } from 'lodash-es'
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import ClipboardJS from 'clipboard'

import { useSiteStore } from 'src/stores/site'

import CheckUpdateDialog from '../components/CheckUpdateDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.system.title')
})

// DATA

const state = reactive({
  clip: null,
  loading: 0,
  isUpgrading: false,
  isUpgradingStarted: false,
  upgradeProgress: 0,
  info: {
    platform: ''
  }
})

// REFS

const copySysInfoBtn = ref(null)

// COMPUTED

const dbVersion = computed(() => {
  return state.info?.dbVersion?.replace(/(?:\r\n|\r|\n)/g, ', ')
})
const platformLogo = computed(() => {
  switch (state.info.platform) {
    case 'docker':
      return 'docker-container'
    case 'darwin':
      return 'apple-logo'
    case 'linux':
      if (this.info.operatingSystem.indexOf('Ubuntu') >= 0) {
        return 'ubuntu'
      } else {
        return 'linux'
      }
    case 'win32':
      return 'windows8'
    default:
      return 'washing-machine'
  }
})
const clientBrowser = computed(() => {
  return !import.meta.env.SSR ? navigator.userAgent : ''
})
const clientPlatform = computed(() => {
  return !import.meta.env.SSR ? navigator.platform : ''
})
const clientLanguage = computed(() => {
  return !import.meta.env.SSR ? navigator.language : ''
})
const clientCookies = computed(() => {
  return !import.meta.env.SSR ? navigator.cookieEnabled : ''
})
const clientViewport = computed(() => {
  return !import.meta.env.SSR ? `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}` : ''
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getSystemInfo {
        systemInfo {
          configFile
          cpuCores
          currentVersion
          dbHost
          dbVersion
          hostname
          latestVersion
          latestVersionReleaseDate
          nodeVersion
          operatingSystem
          platform
          ramTotal
          upgradeCapable
          workingDirectory
        }
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.info = cloneDeep(resp?.data?.systemInfo)
  $q.loading.hide()
  state.loading--
}

function checkForUpdates () {
  $q.dialog({
    component: CheckUpdateDialog
  }).onDismiss(() => {
    load()
  })
}

// MOUNTED

onMounted(() => {
  load()
  const clip = new ClipboardJS(copySysInfoBtn.value.$el, {
    text: () => {
      return `Wiki.js ${state.info.currentVersion}
Postgres ${dbVersion.value}
Node.js ${state.info.nodeVersion}
OS: ${state.info.operatingSystem}
Platform: ${state.info.platform}
CPU Cores: ${state.info.cpuCores}
Total RAM: ${state.info.ramTotal}`
    }
  })

  clip.on('success', () => {
    $q.notify({
      type: 'positive',
      message: 'Info copied successfully',
      icon: 'las la-clipboard'
    })
  })
  clip.on('error', () => {
    $q.notify({
      type: 'negative',
      message: 'Failed to copy system info'
    })
  })
})

</script>

<style lang='scss'>
.admin-system {
  .v-list-item-title, .v-list-item__subtitle {
    user-select: text;
  }

  .dark-value {
    background-color: #F8F8F8;
    color: #333;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: 'Roboto Mono', Consolas, "Liberation Mono", Courier, monospace;

    @at-root .body--dark & {
      background-color: $dark-4;
      color: #FFF;
    }
  }
}
</style>
