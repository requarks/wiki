<template>
  <w-page class="admin-extensions">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-module.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.extensions.title') }}
        </div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.extensions.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/extensions`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12">
        <w-card>
          <w-list separator>
            <w-item v-for="ext of state.extensions" :key="`ext-` + ext.key">
              <blueprint-icon icon="module" />
              <w-item-section>
                <w-item-label>{{ ext.title }}</w-item-label>
                <w-item-label caption>{{ ext.description }}</w-item-label>
                <w-item-label caption v-if="ext.website">
                  <a class="text-primary" :href="ext.website" target="_blank" rel="noopener">{{
                    ext.website
                  }}</a>
                </w-item-label>
              </w-item-section>
              <w-item-section side>
                <div class="flex flex-wrap">
                  <w-btn-group unelevated>
                    <w-btn
                      icon="la:check"
                      size="sm"
                      color="positive"
                      padding="xs sm"
                      v-if="ext.isInstalled">
                      <w-tooltip anchor="center left" self="center right">{{
                        t('admin.extensions.installed')
                      }}</w-tooltip>
                    </w-btn>
                    <w-btn
                      :label="t(`admin.extensions.install`)"
                      color="blue-7"
                      v-if="ext.isCompatible && !ext.isInstalled && ext.isInstallable"
                      @click="install(ext)"
                      no-caps />
                    <w-btn
                      v-else-if="ext.isCompatible && ext.isInstalled && ext.isInstallable"
                      :label="t(`admin.extensions.reinstall`)"
                      color="blue-7"
                      @click="install(ext)"
                      no-caps />
                    <w-btn
                      v-else-if="ext.isCompatible && ext.isInstalled && !ext.isInstallable"
                      :label="t(`admin.extensions.installed`)"
                      color="positive"
                      no-caps />
                    <w-btn
                      v-else-if="ext.isCompatible"
                      :label="t(`admin.extensions.instructions`)"
                      icon="la:info-circle"
                      color="indigo"
                      outline
                      :href="`https://docs.js.wiki/admin/extensions/` + ext.key"
                      target="_blank"
                      no-caps>
                      <w-tooltip anchor="center left" self="center right">{{
                        t('admin.extensions.instructionsHint')
                      }}</w-tooltip>
                    </w-btn>
                    <w-btn
                      v-else
                      color="negative"
                      outline
                      :label="t(`admin.extensions.incompatible`)"
                      no-caps />
                  </w-btn-group>
                </div>
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive } from 'vue'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.extensions.title')
})

// DATA

const state = reactive({
  loading: 0,
  extensions: []
})

/**
 * How long to give an install, in milliseconds.
 *
 * Stated because the client's own default is ten seconds, which no npm install finishes inside: the
 * request would be abandoned here while npm carried on running on the server, reporting a failure for
 * something that was about to succeed and leaving the administrator to install it twice. Matches the
 * ceiling the server puts on the same work, Puppeteer's browser download being what sets it.
 */
const INSTALL_TIMEOUT = 20 * 60 * 1000

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    state.extensions = (await API_CLIENT.get('system/extensions').json()) ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.extensions.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function install(ext) {
  loading.show({
    message: t('admin.extensions.installing') + '<br>' + t('admin.extensions.installingHint'),
    html: true
  })
  try {
    const resp = await API_CLIENT.post(`system/extensions/${ext.key}/install`, {
      timeout: INSTALL_TIMEOUT
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured')
    }
    // -> A reinstall repairs the files on disk, but a server that already failed to load the module
    //    keeps failing until it restarts — so that answer is a warning, not a success
    notify({
      type: resp.restartRequired ? 'warning' : 'positive',
      message: resp.restartRequired
        ? t('admin.extensions.installRestartRequired')
        : t('admin.extensions.installSuccess'),
      timeout: resp.restartRequired ? 10000 : undefined
    })
    // -> Re-detect rather than assume: the install is only done once the server can see the tool
    await load()
  } catch (err) {
    // -> ky throws above 400 — an extension that must be installed by hand answers 409 saying so
    notify({
      type: 'negative',
      message: t('admin.extensions.installFailed'),
      caption: apiErrorMessage(err)
    })
  }
  loading.hide()
}

// MOUNTED

onMounted(() => {
  load()
})
</script>
