<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 680px; max-width: 94vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-change.svg" size="sm" class="mr-2" />
        <span>{{ t('common.feedback.changeStatus') }}</span>
      </w-card-section>
      <w-card-section>
        <!--
          Every status, the current one included and marked as such, so that the list reads as where
          the idea could go rather than as a list that changes shape depending on where it is.

          Each tinted in its status's colour exactly as the badge is (`FeedbackStatusBadge.vue`), so
          that the button picked is the look the idea will wear. Where the idea is now is the one
          drawn solid, and ringed until another is picked; the pick then takes the ring, in its own
          full colour, and a tick, so that the list reads as from the solid one to the ringed one.
        -->
        <div class="feedback-status-options" role="radiogroup">
          <button
            v-for="status of FEEDBACK_STATUSES"
            :key="status"
            type="button"
            role="radio"
            class="feedback-status-option"
            :class="{ 'is-selected': isRinged(status), 'is-current': status === current }"
            :style="{ '--status-hue': `var(--color-${FEEDBACK_STATUS_LOOK[status].color})` }"
            :aria-checked="state.status === status"
            :disabled="status === current"
            @click="state.status = status">
            <w-icon :name="FEEDBACK_STATUS_LOOK[status].icon" size="sm" />
            <span class="feedback-status-option-label">
              {{ t(`common.feedback.statuses.${status}`) }}
            </span>
            <span class="feedback-status-option-current" v-if="status === current">
              {{ t('common.feedback.currentStatus') }}
            </span>
            <w-icon v-else-if="state.status === status" name="la:check" size="sm" />
          </button>
        </div>
        <!--
          What the change says, posted to the discussion with it. Only where there is a discussion to
          post it to; without one the change is made on its own, and says so.
        -->
        <feedback-markdown-field
          v-if="canComment"
          class="mt-4"
          v-model="state.comment"
          preview-class="page-comment-body"
          :rows="4"
          :label="t('common.feedback.statusComment')"
          :placeholder="t('common.feedback.statusCommentHint')"
          :hint="t('common.comments.markdownHint')" />
        <div class="text-caption text-grey-6 mt-4" v-else>
          {{ t('common.feedback.statusNoComment') }}
        </div>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="cancel"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          icon="la:check"
          :label="t('common.feedback.changeStatus')"
          color="primary"
          padding="xs md"
          :loading="state.busy"
          :disable="!state.status || state.status === current"
          @click="save" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { apiErrorMessage } from '@/helpers/apiError'
import { FEEDBACK_STATUS_LOOK, FEEDBACK_STATUSES } from '@/helpers/pageFeedback'

import { useSiteStore } from '@/stores/site'

import FeedbackMarkdownField from '@/components/FeedbackMarkdownField.vue'

/**
 * Moving an idea on a feedback board to another status, with a comment saying why if there is one.
 *
 * One request for both (`PUT …/feedback/ideas/:id/status`): the server posts the comment in the same
 * transaction as it writes the status, so neither can happen without the other. Without a comment
 * nothing appears in the discussion; the change is in the audit log regardless.
 *
 * Answers `.onOk()` with `{ comment }` — the comment that was posted, or null — so that the page can
 * bring its discussion up to date and show it.
 */
const props = defineProps({
  pageId: {
    type: String,
    required: true
  },
  /** Where the idea stands now, which is not a change to offer. */
  current: {
    type: String,
    default: 'open'
  },
  /** Whether the idea has a discussion to post a comment in. */
  canComment: {
    type: Boolean,
    default: false
  }
})

defineEmits(dialogComponentEmits)

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

const siteStore = useSiteStore()

const { t } = useI18n()

const state = reactive({
  status: null,
  comment: '',
  busy: false
})

/** Whether a status wears the ring: the one picked, or where the idea is while nothing has been. */
function isRinged(status) {
  return state.status ? state.status === status : status === props.current
}

async function save() {
  state.busy = true
  try {
    const comment = props.canComment ? state.comment.trim() : ''
    const resp = await API_CLIENT.put(
      `sites/${siteStore.id}/feedback/ideas/${props.pageId}/status`,
      { json: { status: state.status, ...(comment && { comment }) } }
    ).json()
    notify({ type: 'positive', message: t('common.feedback.statusSaved') })
    onDialogOK({ comment: resp.comment ?? null })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.feedback.statusFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.busy = false
  }
}
</script>

<style lang="scss">
.feedback-status-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}

.feedback-status-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 0;
  border-radius: 6px;
  /* -> The badge's mix, light and dark: a pale tint with a dark shade of the hue for its ink */
  background-color: color-mix(in srgb, var(--status-hue) 14%, #fff);
  color: color-mix(in srgb, var(--status-hue) 60%, #000);
  font: inherit;
  font-weight: 500;
  text-align: start;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    outline-color 0.15s ease;

  @at-root .body--dark & {
    background-color: color-mix(in srgb, var(--status-hue) 26%, transparent);
    color: color-mix(in srgb, var(--status-hue) 45%, #fff);
  }

  &-label {
    flex: 1 1 auto;
    min-width: 0;
  }

  &-current {
    font-size: 0.75rem;
    font-weight: 400;
    opacity: 0.85;
  }

  /* -> A step deeper into the same tint, which is what a pale button can show a pointer with */
  &:hover:not(:disabled) {
    background-color: color-mix(in srgb, var(--status-hue) 22%, #fff);

    @at-root .body--dark & {
      background-color: color-mix(in srgb, var(--status-hue) 36%, transparent);
    }
  }

  /* -> Clear of the button rather than on it, in its own colour: the ring and the tick are the pick */
  &.is-selected,
  &:focus-visible {
    outline: 2px solid var(--status-hue);
    outline-offset: 2px;
  }

  /*
    Where the idea already is: the list's fixed point, drawn solid in its own colour rather than as
    a choice. Not dimmed -- that made it read as unavailable rather than as where the idea stands.
    The hue is taken a little towards black so that white stays legible on the lightest of them
    (amber), in both themes.
  */
  &.is-current {
    background-color: color-mix(in srgb, var(--status-hue) 85%, #000);
    color: #fff;

    @at-root .body--dark & {
      background-color: color-mix(in srgb, var(--status-hue) 85%, #000);
      color: #fff;
    }
  }

  &:disabled {
    cursor: default;
  }
}
</style>
