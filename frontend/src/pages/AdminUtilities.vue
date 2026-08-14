<template>
  <w-page class="admin-utilities">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-swiss-army-knife-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.utilities.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.utilities.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/utilities`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
      </div>
    </div>
    <w-separator inset />
    <div class="p-4 gap-4">
      <w-card>
        <w-list separator>
          <w-item>
            <blueprint-icon icon="disconnected" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.disconnectWS`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.disconnectWSHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                @click="disconnectWS"
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="database-export" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.export`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.exportHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                disabled
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="datalake" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.flushCache`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.flushCacheHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                @click="flushCache"
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="database-restore" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.import`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.importHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                disabled
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="matches" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.invalidApiCertificates`) }}</w-item-label>
              <w-item-label caption>{{
                t(`admin.utilities.invalidApiCertificatesHint`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                @click="invalidateApiCertificates"
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="key" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.invalidSessionSecret`) }}</w-item-label>
              <w-item-label caption>{{
                t(`admin.utilities.invalidSessionSecretHint`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                @click="invalidateSessionSecret"
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="historical" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.purgeHistory`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.purgeHistoryHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-select
                outlined
                :label="t(`admin.utilities.purgeHistoryTimeframe`)"
                v-model="state.purgeHistoryTimeframe"
                style="min-width: 175px"
                emit-value
                map-options
                dense
                :options="purgeHistoryTimeframes" />
            </w-item-section>
            <w-separator class="ml-2" vertical />
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                @click="purgeHistory"
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="trash" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.purgeRevokedKeys`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.purgeRevokedKeysHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                @click="purgeRevokedKeys"
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="rescan-document" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.scanPageProblems`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.scanPageProblemsHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                disabled
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
        </w-list>
      </w-card>
    </div>
  </w-page>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { confirm } from '@/composables/dialog'
import { apiErrorMessage } from '@/helpers/apiError'

import { useSiteStore } from '@/stores/site'

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.utilities.title')
})

// DATA

const state = reactive({
  purgeHistoryTimeframe: '1y'
})

// COMPUTED

const purgeHistoryTimeframes = computed(() => [
  { value: '24h', label: t('admin.utitilies.purgeHistoryToday') },
  { value: '1m', label: t('admin.utitilies.purgeHistoryMonth', 1, { count: 1 }) },
  { value: '3m', label: t('admin.utitilies.purgeHistoryMonth', 3, { count: 3 }) },
  { value: '6m', label: t('admin.utitilies.purgeHistoryMonth', 6, { count: 6 }) },
  { value: '1y', label: t('admin.utitilies.purgeHistoryYear', 1, { count: 1 }) },
  { value: '2y', label: t('admin.utitilies.purgeHistoryYear', 2, { count: 2 }) }
])

// METHODS

/**
 * Close every websocket the wiki holds — the editors of anyone collaborating on a page, and any open
 * admin terminal. Confirmed first because it interrupts people who are working: their clients
 * reconnect on their own, but an editor is briefly cut off from the others in its room.
 *
 * Both this and {@link flushCache} reach every instance: the one answering the request acts on itself
 * and publishes the same instruction to the others. `count` in the response is therefore only what
 * this one closed, which is why it is not reported.
 */
function disconnectWS() {
  confirm({
    title: t('admin.utilities.disconnectWS'),
    message: t('admin.utilities.disconnectWSConfirm'),
    cancel: true,
    color: 'negative',
    okLabel: t('common.actions.proceed')
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await API_CLIENT.post('system/websockets/disconnect').json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('admin.utilities.disconnectWSSuccess')
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.utilities.disconnectWSFailed'),
        caption: apiErrorMessage(err)
      })
    }
    loading.hide()
  })
}

/**
 * Replace the keypair API keys are signed with, taking back every key ever issued.
 *
 * Nobody is logged out by this — session cookies are signed with a secret of their own, which is the
 * point of the two being separate — but every integration holding a key stops working until it is
 * given a new one, so the confirmation says how many are affected rather than asking blind.
 */
function invalidateApiCertificates() {
  confirm({
    title: t('admin.utilities.invalidApiCertificates'),
    message: t('admin.utilities.invalidApiCertificatesConfirm'),
    caption: t('admin.utilities.invalidApiCertificatesConfirmWarn'),
    cancel: true,
    persistent: true,
    color: 'negative',
    okLabel: t('common.actions.proceed')
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await API_CLIENT.post('system/certificates').json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      const count = resp.invalidatedKeys ?? 0
      notify({
        type: 'positive',
        message: t('admin.utilities.invalidApiCertificatesSuccess', count, { count })
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.utilities.invalidApiCertificatesFailed'),
        caption: apiErrorMessage(err)
      })
    }
    loading.hide()
  })
}

/**
 * Rotate the secret session cookies are signed with, and end every session.
 *
 * Including this one: the admin who clicks it is logged out with everybody else, which the
 * confirmation says outright. Nothing is notified afterwards for that reason — the router lands on
 * the login screen while the notification would still be on its way.
 */
function invalidateSessionSecret() {
  confirm({
    title: t('admin.utilities.invalidSessionSecret'),
    message: t('admin.utilities.invalidSessionSecretConfirm'),
    caption: t('admin.utilities.invalidSessionSecretConfirmWarn'),
    cancel: true,
    persistent: true,
    color: 'negative',
    okLabel: t('common.actions.proceed')
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await API_CLIENT.post('system/sessions/invalidate').json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      // -> This session is one of the ones just ended, so there is nowhere to go but back to the
      //    login screen. A full load rather than a route push: every store is holding the state of
      //    somebody who is no longer signed in.
      window.location.assign('/login')
    } catch (err) {
      loading.hide()
      notify({
        type: 'negative',
        message: t('admin.utilities.invalidSessionSecretFailed'),
        caption: apiErrorMessage(err)
      })
    }
  })
}

/**
 * Delete every page version older than the selected timeframe, on every site.
 *
 * Confirmed, and named in the confirmation: pages keep what they say now, but a version thrown away
 * here is gone for good — and the versions of a page somebody deleted are all that is left of it.
 */
function purgeHistory() {
  const timeframe = purgeHistoryTimeframes.value.find(
    (tf) => tf.value === state.purgeHistoryTimeframe
  )
  confirm({
    title: t('admin.utilities.purgeHistory'),
    message: t('admin.utilities.purgeHistoryConfirm', { timeframe: timeframe?.label ?? '' }),
    caption: t('admin.utilities.purgeHistoryConfirmWarn'),
    cancel: true,
    persistent: true,
    color: 'negative',
    okLabel: t('common.actions.proceed')
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await API_CLIENT.post('system/history/purge', {
        json: { olderThan: state.purgeHistoryTimeframe }
      }).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      const count = resp.count ?? 0
      notify({
        type: 'positive',
        message: t('admin.utilities.purgeHistorySuccess', count, { count })
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.utilities.purgeHistoryFailed'),
        caption: apiErrorMessage(err)
      })
    }
    loading.hide()
  })
}

/**
 * Delete the rows of keys somebody revoked.
 *
 * Confirmed, but not coloured as a destruction: nothing loses access here, since a revoked key
 * already had none. What goes is the record that it existed.
 */
function purgeRevokedKeys() {
  confirm({
    title: t('admin.utilities.purgeRevokedKeys'),
    message: t('admin.utilities.purgeRevokedKeysConfirm'),
    caption: t('admin.utilities.purgeRevokedKeysConfirmWarn'),
    cancel: true,
    persistent: true,
    color: 'negative',
    okLabel: t('common.actions.proceed')
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await API_CLIENT.post('system/api-keys/purge').json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      const count = resp.count ?? 0
      notify({
        type: 'positive',
        message: t('admin.utilities.purgeRevokedKeysSuccess', count, { count })
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.utilities.purgeRevokedKeysFailed'),
        caption: apiErrorMessage(err)
      })
    }
    loading.hide()
  })
}

/**
 * Throw away everything the wiki has cached off the database — files, icons, and the site, group and
 * locale state read on every request. Not confirmed: nothing is lost and nothing stops working, the
 * next request simply pays for the refill.
 */
async function flushCache() {
  loading.show()
  try {
    const resp = await API_CLIENT.post('system/cache/flush').json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.utilities.flushCacheSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.utilities.flushCacheFailed'),
      caption: apiErrorMessage(err)
    })
  }
  loading.hide()
}
</script>

<style lang="scss"></style>
