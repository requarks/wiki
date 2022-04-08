<template lang='pug'>
q-page.admin-system
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-processor.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.system.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.system.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.js.wiki/admin/system'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='loading > 0'
        @click='load'
        )
      q-btn.acrylic-btn(
        ref='copySysInfoBtn'
        flat
        icon='las la-clipboard'
        label='Copy System Info'
        color='primary'
        @click=''
        :disabled='loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-6
      //- -----------------------
      //- WIKI.JS
      //- -----------------------
      q-card.q-pb-sm.shadow-1
        q-card-section
          .text-subtitle1 Wiki.js
        q-item
          blueprint-icon(icon='breakable', :hue-rotate='-45')
          q-item-section
            q-item-label {{ $t('admin.system.currentVersion') }}
            q-item-label(caption) {{$t('admin.system.currentVersionHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.currentVersion }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='cloud-checked', :hue-rotate='-45')
          q-item-section
            q-item-label {{ $t('admin.system.latestVersion') }}
            q-item-label(caption) {{$t('admin.system.latestVersionHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.latestVersion }}

      //- -----------------------
      //- CLIENT
      //- -----------------------
      q-no-ssr
        q-card.q-mt-md.q-pb-sm.shadow-1
          q-card-section
            .text-subtitle1 {{$t('admin.system.client')}}
          q-item
            blueprint-icon(icon='navigation-toolbar-top', :hue-rotate='-45')
            q-item-section
              q-item-label {{$t('admin.system.browser')}}
              q-item-label(caption) {{$t('admin.system.browserHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientBrowser }}
          q-separator(inset)
          q-item
            blueprint-icon(icon='computer', :hue-rotate='-45')
            q-item-section
              q-item-label {{$t('admin.system.clientPlatform')}}
              q-item-label(caption) {{$t('admin.system.clientPlatformHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientPlatform }}
          q-separator(inset)
          q-item
            blueprint-icon(icon='translation', :hue-rotate='-45')
            q-item-section
              q-item-label {{$t('admin.system.clientLanguage')}}
              q-item-label(caption) {{$t('admin.system.clientLanguageHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientLanguage }}
          q-separator(inset)
          q-item
            blueprint-icon(icon='cookies', :hue-rotate='-45')
            q-item-section
              q-item-label {{$t('admin.system.clientCookies')}}
              q-item-label(caption) {{$t('admin.system.clientCookiesHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientCookies }}
          q-separator(inset)
          q-item
            blueprint-icon(icon='widescreen', :hue-rotate='-45')
            q-item-section
              q-item-label {{$t('admin.system.clientViewport')}}
              q-item-label(caption) {{$t('admin.system.clientViewportHint')}}
            q-item-section
              q-item-label.dark-value(caption) {{ clientViewport }}

    .col-6
      //- -----------------------
      //- ENGINES
      //- -----------------------
      q-card.q-pb-sm.shadow-1
        q-card-section
          .text-subtitle1 {{$t('admin.system.engines')}}
        q-item
          blueprint-icon(icon='nodejs', :hue-rotate='-45')
          q-item-section
            q-item-label Node.js
            q-item-label(caption) {{$t('admin.system.nodejsHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.nodeVersion }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='postgresql', :hue-rotate='-45')
          q-item-section
            q-item-label {{$t('admin.system.database')}}
            q-item-label(caption) {{$t('admin.system.databaseHint')}}
          q-item-section
            q-item-label.dark-value(caption) PostgreSQL {{dbVersion}}
        q-separator(inset)
        q-item
          blueprint-icon(icon='database', :hue-rotate='-45')
          q-item-section
            q-item-label {{$t('admin.system.databaseHost')}}
            q-item-label(caption) {{$t('admin.system.databaseHostHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.dbHost }}

      //- -----------------------
      //- HOST INFORMATION
      //- -----------------------
      q-card.q-mt-md.q-pb-sm.shadow-1
        q-card-section
          .text-subtitle1 {{ $t('admin.system.hostInfo') }}
        q-item
          blueprint-icon(:icon='platformLogo', :hue-rotate='-45')
          q-item-section
            q-item-label {{ $t('admin.system.os') }}
            q-item-label(caption) {{$t('admin.system.osHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ (info.platform === 'docker') ? 'Docker Container (Linux)' : info.operatingSystem }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='server', :hue-rotate='-45')
          q-item-section
            q-item-label {{ $t('admin.system.hostname') }}
            q-item-label(caption) {{$t('admin.system.hostnameHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.hostname }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='processor', :hue-rotate='-45')
          q-item-section
            q-item-label {{ $t('admin.system.cpuCores') }}
            q-item-label(caption) {{$t('admin.system.cpuCoresHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.cpuCores }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='memory-slot', :hue-rotate='-45')
          q-item-section
            q-item-label {{ $t('admin.system.totalRAM') }}
            q-item-label(caption) {{$t('admin.system.totalRAMHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.ramTotal }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='program', :hue-rotate='-45')
          q-item-section
            q-item-label {{ $t('admin.system.workingDirectory') }}
            q-item-label(caption) {{$t('admin.system.workingDirectoryHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.workingDirectory }}
        q-separator(inset)
        q-item
          blueprint-icon(icon='automation', :hue-rotate='-45')
          q-item-section
            q-item-label {{ $t('admin.system.configFile') }}
            q-item-label(caption) {{$t('admin.system.configFileHint')}}
          q-item-section
            q-item-label.dark-value(caption) {{ info.configFile }}

  //-                 v-list-item-action-text {{ $t('admin.system.published') }} {{ info.latestVersionReleaseDate | moment('from') }}
  //-           v-card-actions(v-if='info.upgradeCapable && !isLatestVersion && info.platform === `docker`', :class='$vuetify.theme.dark ? `grey darken-3-d5` : `indigo lighten-5`')
  //-             .caption.indigo--text.pl-3(:class='$vuetify.theme.dark ? `text--lighten-4` : ``') Wiki.js can perform the upgrade to the latest version for you.
  //-             v-spacer
  //-             v-btn.px-3(
  //-               color='indigo'
  //-               dark
  //-               @click='performUpgrade'
  //-               )
  //-               v-icon(left) mdi-upload
  //-               span Perform Upgrade

  //- v-dialog(
  //-   v-model='isUpgrading'
  //-   persistent
  //-   width='450'
  //-   )
  //-   v-card.blue.darken-5(dark)
  //-     v-card-text.text-center.pa-10
  //-       self-building-square-spinner(
  //-         :animation-duration='4000'
  //-         :size='40'
  //-         color='#FFF'
  //-         style='margin: 0 auto;'
  //-         )
  //-       .body-2.mt-5.blue--text.text--lighten-4 Your Wiki.js container is being upgraded...
  //-       .caption.blue--text.text--lighten-2 Please wait
  //-       v-progress-linear.mt-5(
  //-         color='blue lighten-2'
  //-         :value='upgradeProgress'
  //-         :buffer-value='upgradeProgress'
  //-         rounded
  //-         :stream='isUpgradingStarted'
  //-         query
  //-         :indeterminate='!isUpgradingStarted'
  //-       )
</template>

<script>
import _get from 'lodash/get'
import cloneDeep from 'lodash/cloneDeep'
import gql from 'graphql-tag'
import { createMetaMixin } from 'quasar'
import ClipboardJS from 'clipboard'

// import { SelfBuildingSquareSpinner } from 'epic-spinners'

export default {
  mixins: [
    createMetaMixin(function () {
      return {
        title: this.$t('admin.system.title')
      }
    })
  ],
  components: {
    // SelfBuildingSquareSpinner
  },
  data () {
    return {
      clip: null,
      loading: 0,
      isUpgrading: false,
      isUpgradingStarted: false,
      upgradeProgress: 0,
      info: {
        platform: ''
      }
    }
  },
  computed: {
    dbVersion () {
      return _get(this.info, 'dbVersion', '').replace(/(?:\r\n|\r|\n)/g, ', ')
    },
    platformLogo () {
      switch (this.info.platform) {
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
    },
    isLatestVersion () {
      return this.info.currentVersion === this.info.latestVersion
    },
    clientBrowser () {
      return !import.meta.env.SSR ? navigator.userAgent : ''
    },
    clientPlatform () {
      return !import.meta.env.SSR ? navigator.platform : ''
    },
    clientLanguage () {
      return !import.meta.env.SSR ? navigator.language : ''
    },
    clientCookies () {
      return !import.meta.env.SSR ? navigator.cookieEnabled : ''
    },
    clientViewport () {
      return !import.meta.env.SSR ? `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}` : ''
    }
  },
  mounted () {
    this.load()
    this.clip = new ClipboardJS(this.$refs.copySysInfoBtn.$el, {
      text: () => {
        return `Wiki.js ${this.info.currentVersion}
Postgres ${this.dbVersion}
Node.js ${this.info.nodeVersion}
OS: ${this.info.operatingSystem}
Platform: ${this.info.platform}
CPU Cores: ${this.info.cpuCores}
Total RAM: ${this.info.ramTotal}`
      }
    })

    this.clip.on('success', () => {
      this.$q.notify({
        message: 'Info copied successfully',
        icon: 'las la-clipboard'
      })
    })
    this.clip.on('error', () => {
      this.$q.notify({
        type: 'negative',
        message: 'Failed to copy to system info'
      })
    })
  },
  methods: {
    async load () {
      this.loading++
      this.$q.loading.show()
      const resp = await this.$apollo.query({
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
      this.info = cloneDeep(resp?.data?.systemInfo)
      this.$q.loading.hide()
      this.loading--
    },
    async performUpgrade () {
      this.isUpgrading = true
      this.isUpgradingStarted = false
      this.upgradeProgress = 0
      this.$store.commit('loadingStart', 'admin-system-upgrade')
      try {
        const respRaw = await this.$apollo.mutate({
          mutation: gql`
            mutation performUpdate {
              system {
                performUpgrade {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `
        })
        const resp = _get(respRaw, 'data.system.performUpgrade.responseResult', {})
        if (resp.succeeded) {
          this.isUpgradingStarted = true
          const progressInterval = setInterval(() => {
            this.upgradeProgress += 0.83
          }, 500)
          setTimeout(() => {
            clearInterval(progressInterval)
            window.location.reload(true)
          }, 60000)
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
        this.$store.commit('loadingStop', 'admin-system-upgrade')
        this.isUpgrading = false
      }
    }
  }
}
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
  }
}
</style>
