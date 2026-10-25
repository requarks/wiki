<template>
  <!--
    `role="status"`: it says something about the article below it, which a screen reader should hear
    once on arriving rather than have to go looking for.
  -->
  <div class="page-lifecycle-banner" role="status">
    <w-icon
      v-if="pageStore.lifecycleBanner.icon"
      :name="pageStore.lifecycleBanner.icon"
      size="24px"
      class="shrink-0" />
    <div class="min-w-0 flex-1 text-body2">{{ pageStore.lifecycleBanner.message }}</div>
    <w-btn
      v-if="pageStore.canMarkReviewed"
      class="shrink-0"
      :label="t(`editor.lifecycle.markReviewed`)"
      icon="mdi:check-decagram-outline"
      color="warning"
      no-caps
      unelevated
      padding="xs md"
      :loading="state.saving"
      @click="markReviewed" />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { reactive } from 'vue'

import { confirm } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

import { usePageStore } from '@/stores/page'

/**
 * What a lifecycle rule put over the article: shown to every reader, with the way to take it down for
 * whoever may — the page's owners and anybody who may edit it, as `viewer.canMarkReviewed` says.
 */

// STORES

const pageStore = usePageStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  saving: false
})

// METHODS

function markReviewed() {
  confirm({
    title: t('editor.lifecycle.markReviewed'),
    icon: 'mdi:check-decagram-outline',
    message: t('editor.lifecycle.markReviewedMessage'),
    caption: t('editor.lifecycle.markReviewedCaption'),
    okLabel: t('editor.lifecycle.markReviewed')
  }).onOk(async () => {
    state.saving = true
    try {
      await pageStore.pageMarkReviewed()
      notify({ type: 'positive', message: t('editor.lifecycle.markedReviewed') })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('editor.lifecycle.markFailed'),
        caption: apiErrorMessage(err)
      })
    } finally {
      state.saving = false
    }
  })
}
</script>

<style lang="scss">
/*
  Amber, the colour of "look at this" rather than "something broke": the article is still there and
  may well still be right. Its own box above `.page-contents` rather than inside it, so none of the
  content typography reaches it.
*/
.page-lifecycle-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 10px 16px;
  border: 1px solid rgba(245, 158, 11, 0.45);
  border-left-width: 4px;
  border-radius: 6px;
  background-color: rgba(245, 158, 11, 0.1);
  color: #92400e;

  .body--dark & {
    border-color: rgba(251, 191, 36, 0.4);
    background-color: rgba(251, 191, 36, 0.08);
    color: #fcd34d;
  }
}
</style>
