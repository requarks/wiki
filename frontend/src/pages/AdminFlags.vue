<template>
  <w-page class="admin-flags">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-windsock-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.flags.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.flags.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/flags`"
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
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :loading="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-7">
        <w-card class="py-2">
          <w-item>
            <w-item-section>
              <w-card class="bg-negative text-white rounded" flat>
                <w-card-section class="items-center" horizontal>
                  <w-card-section class="flex-none pr-0">
                    <w-icon name="la:exclamation-triangle" size="lg" />
                  </w-card-section>
                  <w-card-section>
                    <span>{{ t('admin.flags.warn.label') }}</span>
                    <div class="text-caption text-red-1">{{ t('admin.flags.warn.hint') }}</div>
                  </w-card-section>
                </w-card-section>
              </w-card>
            </w-item-section>
          </w-item>
          <w-item tag="label">
            <blueprint-icon icon="flag-filled" />
            <w-item-section>
              <w-item-label>{{ t(`admin.flags.experimental.label`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.flags.experimental.hint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.flags.experimental"
                :aria-label="t(`admin.flags.experimental.label`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="flag-filled" />
            <w-item-section>
              <w-item-label>{{ t(`admin.flags.authDebug.label`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.flags.authDebug.hint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.flags.authDebug"
                :aria-label="t(`admin.flags.authDebug.label`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="flag-filled" />
            <w-item-section>
              <w-item-label>{{ t(`admin.flags.sqlLog.label`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.flags.sqlLog.hint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle v-model="state.flags.sqlLog" :aria-label="t(`admin.flags.sqlLog.label`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <w-item-section avatar>
              <w-icon name="la:info-circle" color="grey" />
            </w-item-section>
            <w-item-section>
              <w-item-label caption>{{ t(`admin.flags.serverLogNotice`) }}</w-item-label>
            </w-item-section>
          </w-item>
        </w-card>
        <w-card class="py-2 mt-4">
          <w-item>
            <blueprint-icon icon="administrative-tools" />
            <w-item-section>
              <w-item-label>{{ t(`admin.flags.advanced.label`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.flags.advanced.hint`) }}</w-item-label>
              <!-- The editor was never built, and nothing reads custom keys — say so rather than leave -->
              <!-- a disabled button with no explanation -->
              <w-item-label class="text-orange" caption>{{
                t(`admin.flags.advanced.notImplemented`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-btn
                :label="t(`common.actions.edit`)"
                unelevated
                icon="la:code"
                color="primary"
                text-color="white"
                disabled />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-12 max-lg:hidden lg:col-span-5">
        <div class="p-4 text-center">
          <img src="/_assets/illustrations/undraw_settings.svg" style="width: 80%" />
        </div>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useSiteStore } from '@/stores/site'
import { useFlagsStore } from '@/stores/flags'

import { omit } from 'es-toolkit/object'
import { apiErrorMessage } from '@/helpers/apiError'

// STORES

const flagsStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.flags.title')
})

// DATA

const state = reactive({
  loading: 0,
  flags: {
    experimental: false,
    authDebug: false,
    sqlLog: false
  }
})

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    // -> Through the store, so that `experimental` is refreshed for the whole app at the same time
    await flagsStore.load()
    state.flags = omit(flagsStore.$state, ['loaded'])
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.flags.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  if (state.loading > 0) {
    return
  }

  state.loading++
  try {
    const resp = await API_CLIENT.put('system/flags', {
      json: state.flags
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.flags.saveSuccess')
    })
    await load()
  } catch (err) {
    // -> ky doesn't throw on 400, so the API's own message is on the response
    notify({
      type: 'negative',
      message: t('admin.flags.saveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

// MOUNTED

onMounted(load)
</script>

<style lang="scss"></style>
