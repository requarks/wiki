<template>
  <div class="feedback-idea">
    <div class="feedback-idea-bar">
      <!--
        Which board this idea is on, as the way back to it: the board is where the rest of the ideas
        are, and where a reader who followed one here is going next.
      -->
      <w-btn
        class="acrylic-btn"
        flat
        no-caps
        color="grey"
        :text-color="dark.isActive ? `grey-4` : `grey-9`"
        icon="la:arrow-left"
        :label="t('common.feedback.backTo', { board: feedback.board.title })"
        :to="boardHref" />
      <w-space />
      <div class="feedback-idea-actions">
        <w-btn
          v-if="feedback.canSetStatus"
          class="acrylic-btn"
          flat
          no-caps
          :color="actionColor"
          icon="mdi:swap-horizontal"
          :label="t('common.feedback.changeStatus')"
          @click="changeStatus" />
        <!-- -> The author's while it is open, and a moderator's always: it is where they file it -->
        <w-btn
          v-if="feedback.canEditOwn || feedback.canSetStatus"
          class="acrylic-btn"
          flat
          no-caps
          :color="actionColor"
          icon="la:pen"
          :label="t('common.actions.edit')"
          :loading="state.opening"
          @click="edit" />
        <w-btn
          v-if="feedback.canEditOwn"
          class="acrylic-btn"
          flat
          no-caps
          color="negative"
          icon="la:undo-alt"
          :label="t('common.feedback.withdraw')"
          @click="withdraw" />
      </div>
    </div>
    <div class="feedback-idea-head">
      <feedback-vote
        size="lg"
        :count="pageStore.rating?.up ?? 0"
        :voted="pageStore.viewerRating === 1"
        :disable="!canVote"
        :settled="isSettled"
        :busy="state.voting"
        @toggle="vote" />
      <div class="feedback-idea-info">
        <!--
          Where the idea stands, as a bar across the rest of the card in the status's own tint -- the
          badge's (`FeedbackStatusBadge.vue`), drawn wide. When it was last moved sits at its far end,
          and the comment that came with the move, when there was one, is a step further: the answer
          to "why is this Planned" should not be comment forty of a long discussion.
        -->
        <div
          class="feedback-idea-status"
          :style="{ '--status-hue': `var(--color-${statusLook.color})` }">
          <w-icon :name="statusLook.icon" size="sm" />
          <span class="feedback-idea-status-name">
            {{ t(`common.feedback.statuses.${feedback.status}`) }}
          </span>
          <span class="feedback-idea-status-updated" v-if="feedback.statusUpdatedAt">
            {{
              t('common.feedback.statusUpdatedOn', {
                date: userStore.formatDateTime(t, feedback.statusUpdatedAt)
              })
            }}
          </span>
          <w-btn
            v-if="feedback.statusCommentId"
            flat
            round
            dense
            size="sm"
            icon="la:level-down-alt"
            :href="`#comment-${feedback.statusCommentId}`"
            :aria-label="t('common.feedback.seeResponse')">
            <w-tooltip>{{ t('common.feedback.seeResponse') }}</w-tooltip>
          </w-btn>
        </div>
        <!-- -> When it was proposed and by whom, and on the same line what it is filed under -->
        <div class="feedback-idea-meta">
          <div class="feedback-idea-submitter">
            <!-- -> "by" only with somebody to follow it: an account since deleted leaves just the date -->
            <span class="feedback-idea-submitter-date">
              {{
                t(
                  feedback.submittedBy
                    ? 'common.feedback.submittedOnBy'
                    : 'common.feedback.submittedOn',
                  {
                    date: userStore.formatDateTime(t, pageStore.createdAt)
                  }
                )
              }}
            </span>
            <w-avatar
              v-if="feedback.submittedBy"
              size="24px"
              :color="submitterColor"
              text-color="white">
              <img
                v-if="feedback.submittedBy.hasAvatar"
                :src="`/_user/${feedback.submittedBy.id}/avatar`"
                alt="" />
              <span v-else>{{ submitterInitial }}</span>
            </w-avatar>
            <!-- -> Their public profile, as a comment's author name links to it -->
            <router-link
              v-if="feedback.submittedBy"
              class="feedback-idea-submitter-name"
              :to="`/_user/${feedback.submittedBy.id}`">
              {{ feedback.submittedBy.name }}
            </router-link>
          </div>
          <div class="feedback-idea-categories" v-if="categories.length > 0">
            <span class="feedback-idea-category" v-for="category of categories" :key="category.tag">
              {{ category.label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { confirm, dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { apiErrorMessage } from '@/helpers/apiError'
import { avatarColorFor } from '@/helpers/avatarColors'
import { FEEDBACK_STATUS_LOOK, takesVotes } from '@/helpers/pageFeedback'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import FeedbackStatusDialog from '@/components/FeedbackStatusDialog.vue'
import FeedbackSubmitDialog from '@/components/FeedbackSubmitDialog.vue'
import FeedbackVote from '@/components/FeedbackVote.vue'

/**
 * The head of an idea on a feedback board, over its article: the board it is on, the vote, where it
 * stands, what it is filed under, and what this reader may do about any of that.
 *
 * Everything here comes with the page (`feedback` on the page payload, see `api/pages.ts`), including
 * what this reader may do — changing the status takes `review:pages` or `manage:pages` on the board,
 * editing one's own idea takes having submitted it while it is still open. The same pair as the status
 * may also edit any idea, at any status, and is always offered its categories. The vote is the page's
 * own rating, which on an idea is always a thumb up.
 *
 * Emits `changed` with the comment a status change posted, if it posted one, so that the page can
 * bring the discussion under it up to date and take the reader to it.
 */

const emit = defineEmits(['changed'])

// ROUTER

const router = useRouter()

// COMPOSABLES

const dark = useDark()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  voting: false,
  opening: false
})

// COMPUTED

/**
 * The colour of the two primary actions, Change Status and Edit: the lighter primary on a dark page,
 * where the brand colour itself reads dim on the grey the buttons stand on.
 */
const actionColor = computed(() => (dark.isActive ? 'primary-light' : 'primary'))

/** The page's `feedback` block. The component is only mounted while there is one. */
const feedback = computed(() => pageStore.feedback)

const boardHref = computed(
  () => `${siteStore.localeUrlPrefix(pageStore.locale)}/${feedback.value.board.path}`
)

/** The board's categories this idea carries, in the board's order and under the board's labels. */
const categories = computed(() =>
  feedback.value.board.categories.filter((category) => pageStore.tags.includes(category.tag))
)

/**
 * Whether the vote can be pressed: the server answered with a rating, which it does only where the
 * board has voting on and the idea takes ratings. A guest is shown the box as a way to log in.
 */
const canVote = computed(() => Boolean(pageStore.rating))

/** Whether the idea is Completed or Closed, which keeps the count it was settled at (`takesVotes`). */
const isSettled = computed(() => !takesVotes(feedback.value?.status))

/** How the idea's status is drawn: the badge's icon and hue, which the status bar is tinted from. */
const statusLook = computed(
  () => FEEDBACK_STATUS_LOOK[feedback.value.status] ?? FEEDBACK_STATUS_LOOK.open
)

/** The submitter's avatar, as a comment draws its author's: one colour per account, keyed on its id. */
const submitterColor = computed(() => avatarColorFor(feedback.value.submittedBy?.id ?? ''))
const submitterInitial = computed(() =>
  (feedback.value.submittedBy?.name || '?').trim().charAt(0).toUpperCase()
)

/** Whether the idea has a discussion a status comment could be posted in. */
const canComment = computed(() => siteStore.comments.isBuiltIn && pageStore.allowComments)

// METHODS

async function vote() {
  state.voting = true
  try {
    await pageStore.pageRate(pageStore.viewerRating === 1 ? 0 : 1)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.feedback.voteFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.voting = false
  }
}

function changeStatus() {
  dialog({
    component: FeedbackStatusDialog,
    componentProps: {
      pageId: pageStore.id,
      current: feedback.value.status,
      canComment: canComment.value
    }
  }).onOk(async ({ comment }) => {
    await pageStore.pageLoad({ id: pageStore.id })
    emit('changed', { comment })
  })
}

/**
 * The submission form, opened on this idea. Its text is fetched first, from the route that hands it to
 * the author: the page's own source is for whoever may read the source, which an author need not be.
 */
async function edit() {
  state.opening = true
  try {
    const idea = await API_CLIENT.get(`sites/${siteStore.id}/feedback/ideas/${pageStore.id}`).json()
    dialog({
      component: FeedbackSubmitDialog,
      componentProps: {
        board: {
          path: feedback.value.board.path,
          locale: pageStore.locale,
          categories: feedback.value.board.categories,
          submitterCategories: feedback.value.board.submitterCategories,
          voting: feedback.value.board.voting
        },
        idea,
        moderator: feedback.value.canSetStatus
      }
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.feedback.ideaLoadFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.opening = false
  }
}

function withdraw() {
  confirm({
    title: t('common.feedback.withdrawTitle'),
    icon: 'img:/_assets/icons/fluent-delete-bin.svg',
    message: t('common.feedback.withdrawConfirm'),
    persistent: true,
    cancel: true,
    color: 'negative',
    okLabel: t('common.feedback.withdraw')
  }).onOk(async () => {
    try {
      await API_CLIENT.delete(`sites/${siteStore.id}/feedback/ideas/${pageStore.id}`)
      notify({ type: 'positive', message: t('common.feedback.withdrawn') })
      router.push(boardHref.value)
    } catch (err) {
      notify({
        type: 'negative',
        message: t('common.feedback.withdrawFailed'),
        caption: apiErrorMessage(err)
      })
    }
  })
}
</script>

<style lang="scss">
.feedback-idea {
  margin-bottom: 20px;

  /* -> The way back on the left, what can be done about the idea on the right */
  &-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  /*
    Never wrapped: the vote stays beside what it is a vote on, and the bar wraps inside instead.

    Stretched rather than centred, with the vote at its own height at the top: the column beside it
    then runs the card's height and puts the status bar at the top and the submitter at the bottom, so
    both line up with the vote's edges. Centred, the two were a few pixels apart in height and the bar
    sat lower than the vote's top. Where the column is the taller (a phone), the vote stays at the top.
  */
  &-head {
    display: flex;
    align-items: stretch;
    /*
      One distance all round: the card's edge to the vote, the vote to the status bar, and the bar to
      the card's far edge, so that the vote and the bar sit in the card with the same margin on every
      side they show.
    */
    gap: 16px;
    padding: 16px;
    border-radius: 8px;

    > .feedback-vote {
      align-self: flex-start;
    }

    /*
      A card on the board's grey (`.is-idea` in `_page-chrome.scss`), drawn as the board draws its
      ideas: white, with the same hairline and faint two-layer shadow.
    */
    @at-root .body--light & {
      background-color: #fff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.04),
        0 2px 8px rgba(0, 0, 0, 0.04);
      color: rgba(0, 0, 0, 0.87);
    }
    @at-root .body--dark & {
      background-color: $dark-2;
      border: 1px solid rgba(255, 255, 255, 0.06);
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.3),
        0 2px 8px rgba(0, 0, 0, 0.2);
      color: rgba(255, 255, 255, 0.85);
    }
  }

  /* -> The rest of the card beside the vote, so that the status bar can run to its edge */
  &-info {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    justify-content: space-between;
    gap: 10px;
  }

  /*
    The badge's mix, light and dark (`FeedbackStatusBadge.vue`): a pale tint of the status's hue with
    a dark shade of it for the ink, turned over on a dark page. The arrow button takes the ink as its
    own, since a flat button with no colour draws in the colour around it.
  */
  &-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-height: 40px;
    padding: 6px 8px 6px 12px;
    border-radius: 6px;
    background-color: color-mix(in srgb, var(--status-hue) 14%, #fff);
    color: color-mix(in srgb, var(--status-hue) 60%, #000);

    @at-root .body--dark & {
      background-color: color-mix(in srgb, var(--status-hue) 26%, transparent);
      color: color-mix(in srgb, var(--status-hue) 45%, #fff);
    }

    &-name {
      font-weight: 600;
    }

    &-updated {
      margin-inline-start: auto;
      font-size: 0.8rem;
      opacity: 0.85;
    }
  }

  /* -> Who on the left, what it is filed under on the right; the categories wrap under on a phone */
  &-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }

  &-submitter {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;

    /* -> The comment author's link (`.page-comment-author`): the line's own ink, underlined on hover */
    &-name {
      font-weight: 500;
      color: inherit;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    &-date {
      opacity: 0.65;
    }
  }

  &-categories {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
    margin-inline-start: auto;
  }

  &-category {
    padding: 1px 8px;
    border-radius: 3px;
    font-size: 0.75rem;

    @at-root .body--light & {
      background-color: $grey-3;
    }
    @at-root .body--dark & {
      background-color: $dark-2;
    }
  }

  &-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}
</style>
