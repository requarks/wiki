<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/ultraviolet-light-on.svg" left size="md" />
      <span>{{ t(`admin.editors.feedbackName`) }}</span>
      <w-space />
      <w-btn-group push>
        <w-btn
          push
          color="grey-6"
          text-color="white"
          :aria-label="t(`common.actions.refresh`)"
          icon="la:redo-alt"
          @click="load"
          :loading="state.loading > 0">
          <w-tooltip anchor="center left" self="center right">{{
            t(`common.actions.refresh`)
          }}</w-tooltip>
        </w-btn>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.cancel`)"
          :aria-label="t(`common.actions.cancel`)"
          icon="la:times"
          @click="close" />
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(`common.actions.save`)"
          :aria-label="t(`common.actions.save`)"
          icon="la:check"
          @click="save"
          :disabled="state.loading > 0 || !intervalIsValid" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <w-page class="p-4" style="max-width: 1200px; margin: 0 auto">
        <w-card class="shadow-1 pb-2">
          <w-card-section>
            <div class="text-subtitle1">{{ t('admin.editors.feedback.submissions') }}</div>
          </w-card-section>
          <w-item>
            <blueprint-icon icon="timer" />
            <w-item-section>
              <w-item-label>{{ t(`admin.editors.feedback.submissionInterval`) }}</w-item-label>
              <w-item-label caption>{{
                t(`admin.editors.feedback.submissionIntervalHint`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-input
                style="width: 200px"
                outlined
                dense
                hide-bottom-space
                v-model="state.config.submissionInterval"
                :rules="intervalRules"
                :aria-label="t(`admin.editors.feedback.submissionInterval`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <w-inner-loading :showing="state.loading > 0" spinner-class="text-accent" />
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'

import { useAdminStore } from '@/stores/admin'

import { toMerged } from 'es-toolkit/object'

/**
 * The Feedback Board editor's settings for one site.
 *
 * How a board looks and behaves is set on the board itself (`EditorFeedback.vue`); what is set here
 * is the site's, and holds on every board of it: how long an account waits between two submitted
 * ideas. A duration, as the comment cooldown is written -- `30s`, `1m`, `5m` -- or `0` for no limit.
 * The server reads it (`feedback.submissionIntervalFor`) and is what enforces it.
 */

/** A duration the server can read, or `0`. Mirrors `durationToSeconds` in `helpers/common.ts`. */
const INTERVAL_PATTERN = /^(0|\d+[smhdwy])$/

// STORES

const adminStore = useAdminStore()

// I18N

const { t } = useI18n()

// DATA

/**
 * Fallbacks for options a site may not have stored yet, so that every control renders with a
 * defined value. Must mirror the Feedback Board defaults used by the backend when creating a site.
 */
function defaultConfig() {
  return {
    submissionInterval: '1m'
  }
}

const state = reactive({
  config: defaultConfig(),
  loading: 0
})

// COMPUTED

const intervalIsValid = computed(() =>
  INTERVAL_PATTERN.test(`${state.config.submissionInterval ?? ''}`.trim())
)

const intervalRules = [
  (val) =>
    INTERVAL_PATTERN.test(`${val ?? ''}`.trim()) ||
    t('admin.editors.feedback.submissionIntervalInvalid')
]

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json()
    state.config = toMerged(defaultConfig(), resp?.editors?.feedback?.config ?? {})
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.editors.feedback.loadFailed')
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  if (!intervalIsValid.value) {
    return
  }
  state.loading++
  try {
    // -> Only `config` is sent, so the editor's active state is left untouched by the merge
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        editors: {
          feedback: {
            config: { submissionInterval: `${state.config.submissionInterval}`.trim() }
          }
        }
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.editors.feedback.saveSuccess')
    })
    close()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.editors.feedback.saveFailed'),
      caption: err.message
    })
  }
  state.loading--
}

onMounted(() => {
  load()
})
</script>
