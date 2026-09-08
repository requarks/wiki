<template>
  <w-page class="admin-metrics">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-graph.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.metrics.title') }}
        </div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.metrics.subtitle') }}
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center">
          <template v-if="state.enabled">
            <w-signal class="mr-2" color="green" size="md" />
            <div class="text-caption text-green">{{ t('admin.metrics.enabled') }}</div>
          </template>
          <template v-else>
            <w-signal class="mr-2" color="red" size="md" />
            <div class="text-caption text-red">{{ t('admin.metrics.disabled') }}</div>
          </template>
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 ml-4 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/metrics`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="refresh">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2"
          unelevated
          icon="la:power-off"
          :label="!state.enabled ? t(`common.actions.activate`) : t(`common.actions.deactivate`)"
          :color="!state.enabled ? `positive` : `negative`"
          @click="globalSwitch"
          :loading="state.isToggleLoading"
          :disabled="state.loading > 0" />
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
      <div class="col-span-12 lg:col-span-6">
        <w-card
          class="rounded"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:info-circle" size="sm" />
            </w-card-section>
            <w-card-section>
              <i18n-t tag="span" keypath="admin.metrics.endpoint" scope="global">
                <template #endpoint>
                  <strong class="font-robotomono">{{ state.config.path }}</strong>
                </template>
              </i18n-t>
              <div class="text-caption">{{ t('admin.metrics.endpointWarning') }}</div>
            </w-card-section>
          </w-card-section>
        </w-card>
        <!-- ----------------------- -->
        <!-- Configuration -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.metrics.configuration') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="link" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.metrics.path`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.metrics.pathHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 240px">
              <w-input
                outlined
                dense
                v-model="state.config.path"
                :placeholder="`/metrics`"
                :aria-label="t(`admin.metrics.path`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="no-access" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.metrics.anonymousAccess`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.metrics.anonymousAccessHint`) }}</w-item-label>
              <!-- -> An address only means what it looks like when the proxy headers are trusted -->
              <w-item-label
                v-if="!state.trustProxy"
                class="mb-2 text-caption text-orange flex items-center">
                <w-icon class="mr-1" name="la:exclamation-triangle" size="xs" />
                {{ t('admin.metrics.proxyWarning') }}
              </w-item-label>
              <div class="mt-3 flex flex-col gap-3">
                <!-- -> The parentheticals are appended here rather than written into the strings
                     a translator is handed: they are the same in every language, and a typo in one
                     would describe an access rule that is not the one being applied -->
                <w-checkbox
                  v-model="state.config.allowAnonymousLocal"
                  :label="`${t('admin.metrics.anonymousLocal')} (${LOCAL_ADDRESSES})`" />
                <w-checkbox
                  v-model="state.config.allowAnonymousPrivate"
                  :label="`${t('admin.metrics.anonymousPrivate')} (${PRIVATE_STANDARDS})`" />
                <w-checkbox
                  v-model="state.config.allowAnonymousExternal"
                  color="negative"
                  :label="t(`admin.metrics.anonymousExternal`)" />
              </div>
              <!-- -> Ticking the last box is what makes the wiki's internals world-readable, so it
                   says so where it is ticked rather than in the card above -->
              <w-item-label
                v-if="state.config.allowAnonymousExternal"
                class="pl-7 text-caption text-negative flex items-center">
                <w-icon class="mr-1" name="la:exclamation-triangle" size="xs" />
                {{ t('admin.metrics.anonymousExternalWarning') }}
              </w-item-label>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="sigma" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.metrics.included`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.metrics.includedHint`) }}</w-item-label>
              <div class="mt-3 flex flex-col gap-3">
                <w-checkbox
                  v-model="state.config.includeRuntime"
                  :label="t(`admin.metrics.includeRuntime`)" />
                <div>
                  <w-checkbox
                    v-model="state.config.includeWiki"
                    :label="t(`admin.metrics.includeWiki`)" />
                  <!-- -> Under the box rather than in the hint above, because it is the cost of
                       this option specifically: every one of these gauges is a count read fresh -->
                  <div class="pl-7 text-caption text-orange flex items-start">
                    <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
                    <span>{{ t('admin.metrics.includeWikiWarning') }}</span>
                  </div>
                </div>
              </div>
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-6">
        <w-card
          class="rounded"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:key" size="sm" />
            </w-card-section>
            <w-card-section>
              <i18n-t tag="span" keypath="admin.metrics.auth" scope="global">
                <template #permission>
                  <strong class="font-robotomono">read:metrics</strong>
                </template>
              </i18n-t>
              <div class="text-caption mt-2">
                <i18n-t keypath="admin.metrics.authApiKey" scope="global">
                  <template #headerName>
                    <strong class="font-robotomono">Authorization</strong>
                  </template>
                  <template #tokenType><strong class="font-robotomono">Bearer</strong></template>
                </i18n-t>
              </div>
              <div class="text-caption font-robotomono">Authorization: Bearer API-KEY-VALUE</div>
            </w-card-section>
          </w-card-section>
        </w-card>
        <!-- ----------------------- -->
        <!-- Preview -->
        <!-- ----------------------- -->
        <w-card class="mt-4">
          <w-card-header>
            {{ t('admin.metrics.preview') }}
            <template #hint>{{ t('admin.metrics.previewHint') }}</template>
            <template #action>
              <w-btn
                class="acrylic-btn"
                icon="la:redo-alt"
                flat
                dense
                color="secondary"
                :loading="state.preview.loading"
                :aria-label="t(`common.actions.refresh`)"
                @click="loadPreview">
                <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
              </w-btn>
            </template>
          </w-card-header>
          <w-card-section class="pt-0">
            <div v-if="state.preview.error" class="text-caption text-negative flex items-start">
              <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
              <span>{{ state.preview.error }}</span>
            </div>
            <!-- -> Both boxes unticked is a state the form can be in but the endpoint cannot be
                 saved in, so it is worth saying rather than showing an empty box -->
            <div v-else-if="!state.preview.body" class="text-caption text-grey">
              {{ t('admin.metrics.previewEmpty') }}
            </div>
            <template v-else>
              <pre
                class="max-h-96 overflow-auto rounded bg-black/5 p-3 text-caption dark:bg-white/5"><code>{{ state.preview.body }}</code></pre>
              <div class="text-caption text-grey mt-2">
                {{ t('admin.metrics.previewSize', { lines: previewLines, bytes: previewBytes }) }}
              </div>
            </template>
          </w-card-section>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive, watch } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.metrics.title')
}))

/**
 * The loopback addresses the `local` class is named by, shown beside its label.
 *
 * Not translated content — `helpers/network.ts` is what actually decides the class, and it matches
 * the whole of `127.0.0.0/8` alongside `::1`; these are the two addresses a reader recognises.
 */
const LOCAL_ADDRESSES = '127.0.0.1, ::1'

/**
 * The standards the `private` class is drawn from, shown beside its label.
 *
 * All four that `helpers/network.ts` actually implements, in number order: 1918 for the IPv4 private
 * ranges, 3927 and 4291 for IPv4 and IPv6 link-local, 4193 for IPv6 unique local addresses. No single
 * one of them covers the class, so naming only the familiar first would describe a narrower rule than
 * the one being applied.
 */
const PRIVATE_STANDARDS = 'RFC 1918, 3927, 4193, 4291'

// DATA

const state = reactive({
  enabled: false,
  loading: 0,
  isToggleLoading: false,
  // -> Read only, and only to warn: with the proxy headers untrusted every request carries the
  //    proxy's address, so the three classes below are not what an operator would expect
  trustProxy: true,
  config: {
    path: '/metrics',
    allowAnonymousLocal: true,
    allowAnonymousPrivate: true,
    allowAnonymousExternal: false,
    includeRuntime: true,
    includeWiki: false
  },
  preview: {
    body: '',
    loading: false,
    error: null
  }
})

// COMPUTED

const previewLines = computed(() =>
  state.preview.body ? state.preview.body.trimEnd().split('\n').length : 0
)
// -> What a scrape actually transfers, so multi-byte characters in a label count for what they cost
const previewBytes = computed(() => new TextEncoder().encode(state.preview.body).length)

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    const [config, security] = await Promise.all([
      API_CLIENT.get('system/metrics').json(),
      API_CLIENT.get('system/security').json()
    ])
    state.enabled = config?.isEnabled === true
    state.config = { ...state.config, ...config }
    state.trustProxy = security?.trustProxy === true
    // -> Keeps the status light in the admin sidebar in step without another round trip
    adminStore.info.isMetricsEnabled = state.enabled
    // -> Not awaited: collecting the wiki gauges is a dozen queries, and the form should not sit
    //    behind them
    loadPreview()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.metrics.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

/**
 * What a scrape would be answered with.
 *
 * Asks the API rather than fetching the endpoint itself: this has to work while the endpoint is off,
 * and it previews the boxes as they are ticked right now rather than as they were last saved — so
 * the answer to "what does turning this on actually expose" is one click, not save-then-look.
 */
async function loadPreview() {
  state.preview.loading = true
  state.preview.error = null
  try {
    const resp = await API_CLIENT.get('system/metrics/preview', {
      searchParams: {
        includeRuntime: state.config.includeRuntime === true,
        includeWiki: state.config.includeWiki === true
      }
    }).json()
    state.preview.body = resp?.body ?? ''
  } catch (err) {
    state.preview.body = ''
    state.preview.error = apiErrorMessage(err)
  }
  state.preview.loading = false
}

async function refresh() {
  await load()
  notify({
    type: 'positive',
    message: t('admin.metrics.refreshSuccess')
  })
}

async function save() {
  state.loading++
  try {
    const resp = await API_CLIENT.put('system/metrics', {
      json: {
        path: state.config.path,
        allowAnonymousLocal: state.config.allowAnonymousLocal,
        allowAnonymousPrivate: state.config.allowAnonymousPrivate,
        allowAnonymousExternal: state.config.allowAnonymousExternal,
        includeRuntime: state.config.includeRuntime,
        includeWiki: state.config.includeWiki
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    notify({
      type: 'positive',
      message: t('admin.metrics.saveSuccess')
    })
    await load()
  } catch (err) {
    // -> ky throws above 400 — the server refuses a path that would shadow the wiki itself, and an
    //    exposition with nothing in it
    notify({
      type: 'negative',
      message: t('admin.metrics.saveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

async function globalSwitch() {
  state.isToggleLoading = true
  const wanted = !state.enabled
  try {
    const resp = await API_CLIENT.put('system/metrics', {
      json: { isEnabled: wanted }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    notify({
      type: 'positive',
      message: wanted
        ? t('admin.metrics.toggleStateEnabledSuccess')
        : t('admin.metrics.toggleStateDisabledSuccess')
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.metrics.toggleStateFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.isToggleLoading = false
}

// WATCHERS

/*
  The preview claims to show the options as they are ticked, so it has to follow them rather than
  wait for Apply — ticking the wiki group and reading what it would expose is the question this card
  exists to answer. Only these two: the path and the anonymous-access settings change who reaches the
  endpoint and where, not a byte of what it says.
*/
watch(
  () => [state.config.includeRuntime, state.config.includeWiki],
  () => {
    loadPreview()
  }
)

// MOUNTED

onMounted(load)
</script>

<style lang="scss"></style>
