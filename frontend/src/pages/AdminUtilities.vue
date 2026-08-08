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
                :label="t(`common.actions.proceed`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="matches" :hue-rotate="45" />
            <w-item-section>
              <w-item-label>{{ t(`admin.utilities.invalidAuthCertificates`) }}</w-item-label>
              <w-item-label caption>{{
                t(`admin.utilities.invalidAuthCertificatesHint`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
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

async function disconnectWS() {
  loading.show()
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: `
        mutation disconnectWS {
          disconnectWS {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      fetchPolicy: 'network-only'
    })
    if (resp?.data?.disconnectWS?.operation?.succeeded) {
      notify({
        type: 'positive',
        message: t('admin.utilities.disconnectWSSuccess')
      })
    } else {
      throw new Error(resp?.data?.disconnectWS?.operation?.succeeded)
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to disconnect WS connections.',
      caption: err.message
    })
  }
  loading.hide()
}
</script>

<style lang="scss"></style>
