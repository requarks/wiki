<template>
  <w-page class="admin-utilities">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-swiss-army-knife-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.utilities.title') }}
        </div>
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
            <blueprint-icon icon="popcorn-maker" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.generateSample`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.generateSampleHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                :loading="state.sampleLoading"
                @click="generateSampleContent"
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
            <blueprint-icon icon="eraser" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.purgeSample`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.utilities.purgeSampleHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                :loading="state.sampleLoading"
                @click="purgeSampleContent"
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

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import { MarkdownRenderer } from '@/renderers/markdown'

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.utilities.title')
})

// DATA

const state = reactive({
  purgeHistoryTimeframe: '1y',
  /** Shared by both sample-content buttons: neither should be pressable while the other is running. */
  sampleLoading: false
})

// COMPUTED

/** What to call the site the two sample-content actions write to and clear. */
const siteName = computed(
  () => adminStore.sites.find((site) => site.id === adminStore.currentSiteId)?.title ?? ''
)

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
 * Fill the current site with pages to look at.
 *
 * A development convenience: a fresh instance is empty, so checking a stylesheet, a renderer or the
 * navigation against anything means writing dummy pages first. Every page is tagged so
 * {@link purgeSampleContent} can take them all away again.
 *
 * The pages are written one at a time through the ordinary create endpoint — the same one the editor
 * saves through — rather than by a bulk call on the server. That is what makes the content
 * representative: it goes through the same validation, the same render sanitising and the same tree
 * placement as a page somebody typed.
 *
 * **The render is produced here**, by the same markdown renderer the editor uses, because that is
 * where it lives. A page stores the HTML its editor produced, and the server can only produce one by
 * driving a headless browser through the Puppeteer extension — which a plain checkout does not
 * install, so a server-side generator would write pages that are blank until somebody re-renders
 * them.
 */
async function generateSampleContent() {
  const { SAMPLE_CONTENT_TAG, SAMPLE_PAGES } = await import('@/helpers/sampleContent')
  confirm({
    title: t('admin.utilities.generateSample'),
    message: t('admin.utilities.generateSampleConfirm', {
      count: SAMPLE_PAGES.length,
      site: siteName.value
    }),
    caption: t('admin.utilities.generateSampleConfirmWarn', { tag: SAMPLE_CONTENT_TAG }),
    cancel: true,
    persistent: true,
    okLabel: t('common.actions.proceed')
  }).onOk(async () => {
    const siteId = adminStore.currentSiteId
    state.sampleLoading = true
    try {
      /*
        The site's own markdown settings, so the render matches what its editor would have produced —
        line breaks, typography and linkify all change the output. Read from the site rather than from
        `editorStore`, which holds the config of the site being BROWSED, and the admin area may be
        working on another one.
      */
      const site = await API_CLIENT.get(`sites/${siteId}`).json()
      const md = new MarkdownRenderer(site?.editors?.markdown?.config ?? {})

      /*
        Store the icons before the pages that use them, so the wiki can serve them without the Iconify
        API afterwards — which is what the icon picker does when an author chooses one.

        The ones written INTO the content as well as the ones on the pages: a tab's `icon` prop is an
        icon reference like any other, and materializing only the page icons left every tab in the
        sample set with a blank space where its icon should be.

        Best effort: this reaches upstream, which an offline instance does not, and an icon that could
        not be fetched costs a missing picture rather than a page.
      */
      const icons = new Set(SAMPLE_PAGES.map((page) => page.icon))
      for (const page of SAMPLE_PAGES) {
        for (const [, name] of page.content.matchAll(/\bicon="([a-z0-9-]+:[a-z0-9-]+)"/g)) {
          icons.add(name)
        }
      }
      try {
        await API_CLIENT.post('icons/materialize', { json: { icons: [...icons] } }).json()
      } catch (err) {
        console.warn(`Could not store the sample content icons: ${apiErrorMessage(err)}`)
      }

      let created = 0
      const failures = []
      for (const page of SAMPLE_PAGES) {
        try {
          const resp = await API_CLIENT.post(`sites/${siteId}/pages`, {
            json: {
              path: page.path,
              title: page.title,
              description: page.description,
              icon: page.icon,
              editor: 'markdown',
              content: page.content,
              render: md.render(page.content, { pagePath: page.path }),
              // -> The tag the purge looks for, first, then whatever this page is about
              tags: [SAMPLE_CONTENT_TAG, ...page.tags],
              publishState: 'published'
            }
          }).json()
          if (!resp?.ok) {
            throw new Error(resp?.message || 'An unexpected error occured.')
          }
          created++
        } catch (err) {
          // -> One page at a time, and one failure does not stop the rest: a path already taken is
          //    the likely case, and the other twenty pages are still worth having
          failures.push(`${page.path} — ${apiErrorMessage(err)}`)
        }
      }

      if (failures.length > 0) {
        notify({
          type: created > 0 ? 'warning' : 'negative',
          message: t('admin.utilities.generateSamplePartial', created, { count: created }),
          caption: failures.slice(0, 3).join('; ')
        })
      } else {
        notify({
          type: 'positive',
          message: t('admin.utilities.generateSampleSuccess', created, { count: created })
        })
      }
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.utilities.generateSampleFailed'),
        caption: apiErrorMessage(err)
      })
    }
    state.sampleLoading = false
  })
}

/**
 * Delete every page carrying the sample content tag.
 *
 * The tag is the whole of what is consulted, so a page tagged by hand goes with them — which the
 * confirmation says outright, since it is the one way this can take something nobody generated.
 * Folders are left standing: they carry no tags, and one somebody made themselves must not go because
 * a sample page happened to be filed in it.
 */
async function purgeSampleContent() {
  const { SAMPLE_CONTENT_TAG } = await import('@/helpers/sampleContent')
  confirm({
    title: t('admin.utilities.purgeSample'),
    message: t('admin.utilities.purgeSampleConfirm', {
      tag: SAMPLE_CONTENT_TAG,
      site: siteName.value
    }),
    caption: t('admin.utilities.purgeSampleConfirmWarn', { tag: SAMPLE_CONTENT_TAG }),
    cancel: true,
    persistent: true,
    color: 'negative',
    okLabel: t('common.actions.proceed')
  }).onOk(async () => {
    state.sampleLoading = true
    try {
      const resp = await API_CLIENT.post('system/sample-content/purge', {
        json: { siteId: adminStore.currentSiteId }
      }).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      const count = resp.count ?? 0
      notify({
        type: 'positive',
        message: t('admin.utilities.purgeSampleSuccess', count, { count })
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.utilities.purgeSampleFailed'),
        caption: apiErrorMessage(err)
      })
    }
    state.sampleLoading = false
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
