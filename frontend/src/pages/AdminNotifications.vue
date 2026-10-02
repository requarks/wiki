<template>
  <w-page class="admin-notifications">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-topic-push-notification.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.notifications.title') }}
        </div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.notifications.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 ml-4 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/notifications`"
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
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          :loading="state.loading > 0"
          @click="save" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Settings -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.notifications.settings') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="timer" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.notifications.emailDelay`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.notifications.emailDelayHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 160px">
              <w-input
                v-model="state.config.emailDelay"
                outlined
                dense
                placeholder="3m"
                :aria-label="t(`admin.notifications.emailDelay`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="historical" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.notifications.retentionDays`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.notifications.retentionDaysHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 160px">
              <w-input
                v-model="state.config.retentionDays"
                type="number"
                outlined
                dense
                :suffix="t(`admin.notifications.days`)"
                :aria-label="t(`admin.notifications.retentionDays`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="email" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.notifications.mailBatchSize`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.notifications.mailBatchSizeHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 160px">
              <w-input
                v-model="state.config.mailBatchSize"
                type="number"
                outlined
                dense
                :aria-label="t(`admin.notifications.mailBatchSize`)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Status -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.notifications.status') }}
            <template #hint>{{ t('admin.notifications.statusHint') }}</template>
          </w-card-header>
          <w-item>
            <blueprint-icon
              icon="email-open"
              :indicator="state.status.isMailConfigured ? `positive` : `negative`" />
            <w-item-section>
              <w-item-label>{{ t(`admin.notifications.mail`) }}</w-item-label>
              <w-item-label caption>
                {{
                  state.status.isMailConfigured
                    ? t(`admin.notifications.mailConfigured`)
                    : t(`admin.notifications.mailNotConfigured`)
                }}
              </w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:arrow-circle-right"
                color="primary"
                :label="t(`admin.notifications.configureMail`)"
                to="/_admin/mail" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="workflow" />
            <w-item-section>
              <w-item-label>{{ t(`admin.notifications.backlog`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.notifications.backlogHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <div class="text-right">
                <div class="text-h6">{{ state.status.pendingEvents }}</div>
                <div v-if="state.status.oldestPendingEventAt" class="text-caption text-grey">
                  {{
                    t('admin.notifications.oldest', {
                      date: relativeDate(state.status.oldestPendingEventAt)
                    })
                  }}
                </div>
              </div>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="received" />
            <w-item-section>
              <w-item-label>{{ t(`admin.notifications.emails`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.notifications.emailsHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <div class="flex gap-6 text-center">
                <div>
                  <div class="text-h6">{{ state.status.emailsPending }}</div>
                  <div class="text-caption text-grey">{{ t('admin.notifications.pending') }}</div>
                </div>
                <div>
                  <div class="text-h6 text-positive">{{ state.status.emailsSent24h }}</div>
                  <div class="text-caption text-grey">{{ t('admin.notifications.sent') }}</div>
                </div>
                <div>
                  <div
                    class="text-h6"
                    :class="state.status.emailsFailed24h > 0 ? `text-negative` : ``">
                    {{ state.status.emailsFailed24h }}
                  </div>
                  <div class="text-caption text-grey">{{ t('admin.notifications.failed') }}</div>
                </div>
              </div>
            </w-item-section>
          </w-item>
          <template v-for="warning of state.status.warnings" :key="warning">
            <w-separator class="my-2" inset />
            <w-item>
              <w-item-section>
                <div class="text-caption text-deep-orange flex items-start">
                  <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
                  <span>{{ t(`admin.notifications.warnings.${warning}`) }}</span>
                </div>
              </w-item-section>
            </w-item>
          </template>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { loading } from '@/composables/loading'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { relativeDate } from '@/helpers/datetime'

import { useSiteStore } from '@/stores/site'

/**
 * Admin → Notifications: the instance-wide settings of the notification system, and how delivery is
 * doing. Whether a SITE has notifications is under its General → Features; what each person receives
 * is theirs to choose, under Profile → Notifications.
 */

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.notifications.title')
}))

// DATA

const state = reactive({
  loading: 0,
  config: {
    retentionDays: 60,
    emailDelay: '3m',
    mailBatchSize: 100
  },
  status: {
    pendingEvents: 0,
    oldestPendingEventAt: null,
    emailsPending: 0,
    emailsSent24h: 0,
    emailsFailed24h: 0,
    isMailConfigured: true,
    warnings: []
  }
})

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get('system/notifications').json()
    state.config = { ...state.config, ...resp.settings }
    state.status = { ...state.status, ...resp.status }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.notifications.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  loading.hide()
  state.loading--
}

async function refresh() {
  await load()
  notify({
    type: 'positive',
    message: t('admin.notifications.refreshSuccess')
  })
}

async function save() {
  state.loading++
  try {
    await API_CLIENT.put('system/notifications', {
      json: {
        retentionDays: Number(state.config.retentionDays),
        emailDelay: `${state.config.emailDelay ?? ''}`.trim(),
        mailBatchSize: Number(state.config.mailBatchSize)
      }
    })
    notify({
      type: 'positive',
      message: t('admin.notifications.saveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.notifications.saveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

// MOUNTED

onMounted(load)
</script>
