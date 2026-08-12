<template>
  <w-page class="admin-system">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-processor.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.system.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.system.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn"
          ref="copySysInfoBtn"
          flat
          icon="mdi:clipboard-text-outline"
          label="Copy System Info"
          color="primary"
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- WIKI.JS -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>Wiki.js</w-card-header>
          <w-item>
            <blueprint-icon icon="breakable" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.currentVersion') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.currentVersionHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{
                state.info.currentVersion
              }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="cloud-checked" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.latestVersion') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.latestVersionHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <div class="flex flex-wrap gap-2">
                <div class="min-w-0 flex-1">
                  <div class="text-caption dark-value">{{ state.info.latestVersion }}</div>
                </div>
                <div class="flex-none">
                  <w-btn
                    class="acrylic-btn"
                    flat
                    :color="dark.isActive ? `purple-3` : `purple`"
                    @click="checkForUpdates"
                    :label="t(`admin.system.checkUpdate`)" />
                </div>
              </div>
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- CLIENT -->
        <!-- ----------------------- -->
        <w-card class="mt-4 pb-2">
          <w-card-header>{{ t('admin.system.client') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="navigation-toolbar-top" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.browser') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.browserHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ clientBrowser }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="computer" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.clientPlatform') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.clientPlatformHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ clientPlatform }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="translation" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.clientLanguage') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.clientLanguageHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ clientLanguage }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="cookies" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.clientCookies') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.clientCookiesHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ clientCookies }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="widescreen" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.clientViewport') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.clientViewportHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ clientViewport }}</w-item-label>
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- ENGINES -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.system.engines') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="nodejs" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>Node.js</w-item-label>
              <w-item-label caption>{{ t('admin.system.nodejsHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ state.info.nodeVersion }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="postgresql" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.database') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.databaseHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>PostgreSQL {{ dbVersion }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="database" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.databaseHost') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.databaseHostHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ state.info.dbHost }}</w-item-label>
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- HOST INFORMATION -->
        <!-- ----------------------- -->
        <w-card class="mt-4 pb-2">
          <w-card-header>{{ t('admin.system.hostInfo') }}</w-card-header>
          <w-item>
            <blueprint-icon :icon="platformLogo" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.os') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.osHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{
                state.info.platform === 'docker'
                  ? 'Docker Container (Linux)'
                  : state.info.operatingSystem
              }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="server" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.hostname') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.hostnameHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ state.info.hostname }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="processor" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.cpuCores') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.cpuCoresHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ state.info.cpuCores }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="memory-slot" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.totalRAM') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.totalRAMHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ state.info.ramTotal }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="program" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.workingDirectory') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.workingDirectoryHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{
                state.info.workingDirectory
              }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator inset />
          <w-item>
            <blueprint-icon icon="automation" :hue-rotate="-45" />
            <w-item-section>
              <w-item-label>{{ t('admin.system.configFile') }}</w-item-label>
              <w-item-label caption>{{ t('admin.system.configFileHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-item-label class="dark-value" caption>{{ state.info.configFile }}</w-item-label>
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { dialog } from '@/composables/dialog'

import { useSiteStore } from '@/stores/site'

import ClipboardJS from 'clipboard'
import CheckUpdateDialog from '../components/CheckUpdateDialog.vue'

// COMPOSABLES

const dark = useDark()

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
      if (state.info.operatingSystem.indexOf('Ubuntu') >= 0) {
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
  return !import.meta.env.SSR
    ? `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`
    : ''
})

// METHODS

async function load() {
  state.loading++
  loading.show()
  state.info = await API_CLIENT.get('system/info').json()
  loading.hide()
  state.loading--
}

function checkForUpdates() {
  dialog({
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
    notify({
      type: 'positive',
      message: 'Info copied successfully',
      icon: 'la:clipboard'
    })
  })
  clip.on('error', () => {
    notify({
      type: 'negative',
      message: 'Failed to copy system info'
    })
  })
})
</script>

<style lang="scss">
.admin-system {
  .v-list-item-title,
  .v-list-item__subtitle {
    user-select: text;
  }

  .dark-value {
    background-color: #f8f8f8;
    color: #333;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: 'Roboto Mono', Consolas, 'Liberation Mono', Courier, monospace;

    @at-root .body--dark & {
      background-color: $dark-4;
      color: #fff;
    }
  }
}
</style>
