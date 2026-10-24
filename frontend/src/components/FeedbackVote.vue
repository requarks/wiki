<template>
  <!--
    A guest is told to log in rather than shown a dead button: voting needs an account, and pressing
    the box is where they find that out (`FeedbackLoginDialog.vue`).
  -->
  <button
    v-if="offersLogin"
    type="button"
    class="feedback-vote"
    :class="sizeClass"
    :aria-label="t('common.feedback.voteLogin')"
    @click.prevent.stop="askToLogin">
    <w-icon class="feedback-vote-icon" name="mdi:chevron-up" />
    <span class="feedback-vote-count">{{ count }}</span>
    <span class="feedback-vote-label">{{ t('common.feedback.votes', count) }}</span>
    <w-tooltip>{{ t('common.feedback.voteLogin') }}</w-tooltip>
  </button>
  <button
    v-else
    type="button"
    class="feedback-vote"
    :class="[sizeClass, { 'is-voted': voted, 'is-disabled': isDisabled, 'is-settled': settled }]"
    :disabled="isDisabled || busy"
    :aria-pressed="voted"
    :aria-label="voted ? t('common.feedback.unvote') : t('common.feedback.vote')"
    @click.prevent.stop="emit('toggle')">
    <!-- -> No chevron on a settled idea: there is nothing left to press it for -->
    <w-icon v-if="!settled" class="feedback-vote-icon" name="mdi:chevron-up" />
    <span class="feedback-vote-count">{{ count }}</span>
    <span class="feedback-vote-label">{{ t('common.feedback.votes', count) }}</span>
    <w-tooltip v-if="!isDisabled">
      {{ voted ? t('common.feedback.unvote') : t('common.feedback.vote') }}
    </w-tooltip>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialog } from '@/composables/dialog'

import { useUserStore } from '@/stores/user'

import FeedbackLoginDialog from '@/components/FeedbackLoginDialog.vue'

/**
 * An idea's upvote: the count, and the press that adds the reader's vote to it or takes it back.
 *
 * Drawn the same way wherever an idea is — a row of a board's listing, the head of the idea's own page,
 * a possible duplicate in the submission form — so that the thing a reader learns to press on one is
 * the thing they find on the others. It only draws and reports: the request is the caller's
 * (`toggleVote` in `composables/feedback.js`), since what to update after it differs per caller.
 *
 * `click.stop`: in a listing the box sits inside the link to the idea, and a vote is not a visit.
 */
const props = defineProps({
  count: {
    type: Number,
    default: 0
  },
  voted: {
    type: Boolean,
    default: false
  },
  /** A request is out, which holds the box still until it answers. */
  busy: {
    type: Boolean,
    default: false
  },
  /** Voting is off for the board or the idea: the count is still shown, the press is not offered. */
  disable: {
    type: Boolean,
    default: false
  },
  /**
   * The idea is Completed or Closed (`takesVotes` in `helpers/pageFeedback.js`): its count is final,
   * so it is shown without the chevron, and the press is not offered either -- `disable` is implied.
   */
  settled: {
    type: Boolean,
    default: false
  },
  /** `md` in a listing, `lg` at the head of an idea. */
  size: {
    type: String,
    default: 'md'
  }
})

const emit = defineEmits(['toggle'])

// STORES

const userStore = useUserStore()

// I18N

const { t } = useI18n()

// COMPUTED

const sizeClass = computed(() => `is-${props.size}`)

const isDisabled = computed(() => props.disable || props.settled)

const offersLogin = computed(() => !userStore.authenticated && !isDisabled.value)

// METHODS

function askToLogin() {
  dialog({ component: FeedbackLoginDialog, componentProps: { action: 'vote' } })
}
</script>

<style lang="scss">
.feedback-vote {
  display: inline-flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* -> A floor rather than a width, so the side padding is kept however wide the label and count get */
  min-width: 52px;
  padding: 4px 8px 9px;
  border-radius: 6px;
  border: 1px solid transparent;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;

  @at-root .body--light & {
    background-color: #fff;
    border-color: rgba(0, 0, 0, 0.12);
    color: rgba(0, 0, 0, 0.75);
  }
  @at-root .body--dark & {
    background-color: $dark-5;
    border-color: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.8);
  }

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /*
    Voted: the brand colour, filled. A box that only changed its outline read as hovered rather than
    pressed, and "have I voted for this already" is the one thing a reader scanning a board needs to
    see at a glance.
  */
  &.is-voted {
    background-color: var(--color-primary) !important;
    border-color: var(--color-primary) !important;
    color: #fff !important;
  }

  &.is-disabled {
    cursor: default;
    opacity: 0.7;
  }

  &-icon {
    font-size: 22px;
    line-height: 1;
  }

  &-count {
    margin-top: -2px;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  /* -> What the number counts, under it: small and spaced out, so the number stays what is read */
  &-label {
    margin-top: 1px;
    font-size: 0.6rem;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  /*
    Settled: the chevron's height (22px) is given back as padding, half above and half below, so the
    box is the size of every other one in a listing and the count sits in its middle.
  */
  &.is-settled {
    padding-top: calc(4px + 11px);
    padding-bottom: calc(9px + 11px);
  }

  &.is-lg {
    min-width: 64px;
    padding: 6px 10px 11px;

    .feedback-vote-icon {
      font-size: 28px;
    }

    /* -> The same, for the larger chevron (28px) */
    &.is-settled {
      padding-top: calc(6px + 14px);
      padding-bottom: calc(11px + 14px);
    }
    .feedback-vote-count {
      font-size: 1.15rem;
    }
    .feedback-vote-label {
      font-size: 0.65rem;
    }
  }
}
</style>
