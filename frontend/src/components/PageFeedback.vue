<template>
  <div class="page-feedback">
    <!-- -> The board's own words, in basic markdown rendered here from the source it stores -->
    <div class="page-feedback-intro feedback-prose" v-if="settings.intro" v-html="introHtml" />
    <!--
      Search, the order, and the way to add to the board, in one row over the listing. Search first,
      since "is my idea already here" is the question most readers arrive with.
    -->
    <div class="page-feedback-toolbar">
      <w-input
        class="page-feedback-search"
        outlined
        dense
        hide-bottom-space
        clearable
        :model-value="state.q"
        :placeholder="t('common.feedback.searchPlaceholder')"
        :aria-label="t('common.feedback.search')"
        @update:model-value="onSearch">
        <template #prepend>
          <w-icon name="la:search" />
        </template>
      </w-input>
      <w-select
        class="page-feedback-sort"
        outlined
        dense
        emit-value
        map-options
        hide-bottom-space
        :options="sortOptions"
        :model-value="activeSort"
        :aria-label="t('common.feedback.sort')"
        @update:model-value="setSort" />
      <w-space />
      <w-btn
        v-if="showSubmit"
        unelevated
        no-caps
        icon="la:plus"
        color="primary"
        padding="xs md"
        :label="t('common.feedback.submitIdea')"
        @click="openSubmit" />
    </div>
    <div class="page-feedback-status" v-if="feedbackState.loading && !feedbackState.loaded">
      {{ t('common.feedback.loading') }}
    </div>
    <div class="page-feedback-status" v-else-if="feedbackState.failed">
      {{ t('common.feedback.loadFailed') }}
    </div>
    <template v-else>
      <!--
        An empty board and an empty SELECTION are different situations, and only one of them is
        something the reader did: the way out of the second is to widen it, of the first to submit.
      -->
      <div class="page-feedback-empty" v-if="feedbackState.ideas.length < 1">
        <w-icon class="page-feedback-empty-icon" name="mdi:lightbulb-on-outline" />
        <template v-if="boardIsEmpty">
          <div class="text-h6">{{ t('common.feedback.empty') }}</div>
          <div class="text-body2 mt-1 opacity-60">
            {{ t('common.feedback.emptyHint', { path: `/${pageStore.path}/` }) }}
          </div>
        </template>
        <template v-else>
          <div class="text-h6">{{ t('common.feedback.noMatches') }}</div>
          <w-btn
            class="mt-4"
            outline
            no-caps
            color="primary"
            padding="xs md"
            :label="t('common.feedback.clearFilter')"
            @click="clearFilter" />
        </template>
      </div>
      <template v-else>
        <div class="page-feedback-list">
          <router-link
            class="page-feedback-idea"
            :class="[`is-${idea.status}`, { 'has-comments-notch': siteStore.comments.isBuiltIn }]"
            v-for="idea of feedbackState.ideas"
            :key="idea.id"
            :to="ideaLink(idea)">
            <!--
              How much has been said, in a notch cut into the card's top-right corner. Only where the
              discussion is this wiki's own, which is the only kind it can count.
            -->
            <span
              class="page-feedback-idea-comments"
              :class="{ 'has-comments': idea.commentsCount > 0 }"
              v-if="siteStore.comments.isBuiltIn">
              <span class="pe-1">{{ idea.commentsCount }}</span>
              <w-icon name="la:comment" />
            </span>
            <feedback-vote
              :count="idea.upvotes"
              :voted="idea.viewerVoted"
              :disable="!settings.voting"
              :settled="!takesVotes(idea.status)"
              :busy="state.voting === idea.id"
              @toggle="vote(idea)" />
            <span class="page-feedback-idea-body">
              <span class="page-feedback-idea-title">{{ idea.title }}</span>
              <span class="page-feedback-idea-desc" v-if="idea.description">
                {{ idea.description }}
              </span>
              <span class="page-feedback-idea-meta">
                <feedback-status-badge :status="idea.status" size="sm" />
                <!-- -> Plain text rather than links, for the blog's reason: they sit inside the link
                        to the idea, and the filter is picked from the column beside the listing -->
                <span
                  class="page-feedback-idea-category"
                  v-for="tag of idea.categories"
                  :key="tag"
                  >{{ categoryLabel(tag) }}</span
                >
                <!-- -> Who and when, at the far end of the line and flush to the card's edge, where the
                        eye checks them after reading the rest -->
                <span class="page-feedback-idea-byline page-feedback-idea-end">
                  <template v-if="idea.authorName">{{ idea.authorName }} &middot; </template>
                  {{ dateOf(idea.createdAt) }}
                </span>
              </span>
            </span>
          </router-link>
        </div>
        <div class="page-feedback-pager" v-if="feedbackState.pageCount > 1">
          <w-pagination
            :model-value="feedbackState.page"
            :max="feedbackState.pageCount"
            :max-pages="7"
            boundary-numbers
            direction-links
            :aria-label="t(`common.feedback.pagination`)"
            @update:model-value="goToPage" />
        </div>
        <div class="page-feedback-count">
          {{ t('common.feedback.count', feedbackState.total, { count: feedbackState.total }) }}
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { debounce } from 'es-toolkit/function'

import { dialog } from '@/composables/dialog'
import { feedbackState, loadFeedback, resetFeedback, toggleVote } from '@/composables/feedback'
import { notify } from '@/composables/notify'

import { apiErrorMessage } from '@/helpers/apiError'
import { feedbackFilterFromQuery, feedbackFilterQuery } from '@/helpers/feedbackFilter'
import { FEEDBACK_SORTS, parseBoard, takesVotes } from '@/helpers/pageFeedback'
import { renderBoardIntro } from '@/renderers/feedback'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import FeedbackLoginDialog from '@/components/FeedbackLoginDialog.vue'
import FeedbackStatusBadge from '@/components/FeedbackStatusBadge.vue'
import FeedbackSubmitDialog from '@/components/FeedbackSubmitDialog.vue'
import FeedbackVote from '@/components/FeedbackVote.vue'

/**
 * A feedback board's front page: its ideas, rather than an article.
 *
 * The blog's arrangement (`PageBlog.vue`) for a different kind of listing: one row per idea rather than
 * cards, since a board is scanned rather than browsed, with the vote box at the start of each row and
 * the search, the order and Submit Idea over the top.
 *
 * **Which pages are ideas, and which of them this reader sees, is the server's**, which answers it in
 * SQL — every idea on a board is ruled as the board, so there is nothing to decide per idea here or
 * there. See `api/feedback.ts` and `models/feedback.ts`.
 *
 * The reader's selection lives in the query string (`?q=…&sort=…&status=…&category=…&p=…`): see
 * `helpers/feedbackFilter.js`. The status and category halves of it are written by
 * `PageFeedbackSidebar.vue`.
 */

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const route = useRoute()
const router = useRouter()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  /** What is in the search box, which runs ahead of the URL by the debounce below. */
  q: feedbackFilterFromQuery(route.query).q,
  /** The idea whose vote is on its way to the server. */
  voting: null
})

// COMPUTED

/** How this board is set up, which is the front page's content. See `helpers/pageFeedback.js`. */
const settings = computed(() => parseBoard(pageStore.content))

const filter = computed(() => feedbackFilterFromQuery(route.query))

/** The introduction as HTML. See `renderers/feedback.js`: never stored, rendered for each reader. */
const introHtml = computed(() => renderBoardIntro(settings.value.intro))

/** The order on screen: the reader's, or the board's own when they have not picked one. */
const activeSort = computed(() => filter.value.sort ?? settings.value.sort)

const sortOptions = computed(() =>
  FEEDBACK_SORTS.map((value) => ({ value, label: t(`common.feedback.sorts.${value}`) }))
)

/**
 * Whether this reader may submit an idea here: an account, `write:feedback` from the PAGE rules at the
 * board — which is where the server asks it, for every idea on the board — and a board that is taking
 * ideas at all.
 */
const canSubmit = computed(
  () =>
    userStore.authenticated &&
    settings.value.acceptsIdeas &&
    userStore.pagePermissions.includes('write:feedback')
)

/**
 * Whether Submit Idea is shown: to everybody who may submit, and to every guest of a board taking
 * ideas, who is told to log in when they press it (`FeedbackLoginDialog.vue`) rather than never seeing
 * that the board wants their ideas. A signed-in account without `write:feedback` is not offered it,
 * since logging in is not what stands in its way.
 */
const showSubmit = computed(
  () => canSubmit.value || (!userStore.authenticated && settings.value.acceptsIdeas)
)

/**
 * Whether the board itself has no ideas, as against a selection that matched none. The facets are
 * counted before the status and category filters, so their statuses adding up to nothing with no
 * search typed is the board being empty.
 */
const boardIsEmpty = computed(
  () =>
    !filter.value.q &&
    feedbackState.facets.statuses.reduce((sum, entry) => sum + entry.count, 0) < 1
)

// METHODS

function ideaLink(idea) {
  return `${siteStore.localeUrlPrefix(pageStore.locale)}/${idea.path}`
}

/** A category's label on this board, or the tag itself for one the board no longer lists. */
function categoryLabel(tag) {
  return settings.value.categories.find((category) => category.tag === tag)?.label ?? tag
}

function dateOf(value) {
  return userStore.formatDate(value)
}

/** Navigate to the same board with part of the selection changed, back on the first page of it. */
function applyFilter(patch) {
  router.push({ path: route.path, query: feedbackFilterQuery({ ...filter.value, ...patch }) })
}

/*
  Typing is held until the reader pauses, and replaces the history entry rather than adding one:
  every keystroke of "dark mode" is not a place the Back button should stop at.
*/
const commitSearch = debounce((q) => {
  router.replace({
    path: route.path,
    query: feedbackFilterQuery({ ...filter.value, q: q?.trim() ?? '' })
  })
}, 350)

function onSearch(value) {
  state.q = value ?? ''
  commitSearch(state.q)
}

/**
 * A new order. The statuses the reader picked by hand stay as they were; those that were following
 * the old sort follow the new one, which is why `statuses` is carried as it was in the URL — null when
 * nobody picked any.
 */
function setSort(sort) {
  applyFilter({ sort: sort === settings.value.sort ? null : sort })
}

function clearFilter() {
  state.q = ''
  router.push({ path: route.path })
}

function goToPage(page) {
  const query = { ...route.query }
  if (page > 1) {
    query.p = String(page)
  } else {
    delete query.p
  }
  router.push({ path: route.path, query })
}

async function vote(idea) {
  state.voting = idea.id
  try {
    await toggleVote(siteStore.id, idea)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.feedback.voteFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.voting = null
  }
}

function openSubmit() {
  if (!userStore.authenticated) {
    dialog({ component: FeedbackLoginDialog })
    return
  }
  dialog({
    component: FeedbackSubmitDialog,
    componentProps: {
      board: {
        path: pageStore.path,
        locale: pageStore.locale,
        categories: settings.value.categories,
        submitterCategories: settings.value.submitterCategories,
        voting: settings.value.voting,
        submitNotice: settings.value.submitNotice
      },
      // -> The PAGE rules at the board, where the server asks it, as `canSubmit` does
      moderator:
        userStore.pagePermissions.includes('review:pages') ||
        userStore.pagePermissions.includes('manage:pages')
    }
  })
}

function load() {
  if (!pageStore.path) {
    return
  }
  loadFeedback({
    siteId: siteStore.id,
    path: pageStore.path,
    locale: pageStore.locale,
    filter: filter.value
  })
}

// MOUNTED

onMounted(load)

watch(
  () => [
    pageStore.id,
    route.query.q,
    route.query.sort,
    route.query.status,
    route.query.category,
    route.query.p
  ],
  load
)

/* -> A search cleared from somewhere else -- Clear, or Back -- takes the box with it */
watch(
  () => route.query.q,
  (q) => {
    if ((q ?? '') !== state.q.trim()) {
      state.q = q ?? ''
    }
  }
)

onBeforeUnmount(() => {
  commitSearch.cancel()
  resetFeedback()
})
</script>

<style lang="scss">
.page-feedback {
  /* -> Centred and capped by `.page-feedback-frame` around it, in `_page-chrome.scss` */

  /* -> Stated per theme for `.page-blog`'s reason: this sits beside `.page-contents`, not inside it */
  @at-root .body--light & {
    color: $grey-9;
  }
  @at-root .body--dark & {
    color: #fff;
  }

  /* -> The typography of the markdown itself is `.feedback-prose`'s; this is where it sits and its ink */
  &-intro {
    margin: 0 0 20px;
    font-size: 1rem;
    line-height: 1.6;

    @at-root .body--light & {
      color: rgba(0, 0, 0, 0.75);
    }
    @at-root .body--dark & {
      color: rgba(255, 255, 255, 0.75);
    }
  }

  &-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 16px;
  }

  &-search {
    flex: 1 1 260px;
    max-width: 420px;
  }

  &-sort {
    flex: 0 0 auto;
    min-width: 170px;
  }

  &-status {
    padding: 48px 0;
    text-align: center;
    font-size: 0.875rem;
    opacity: 0.6;
  }

  &-empty {
    padding: 56px 16px;
    text-align: center;

    &-icon {
      font-size: 64px;
      opacity: 0.2;
    }
  }

  &-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &-idea {
    /* -> What the comments notch is positioned against */
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    text-decoration: none;

    /*
      The card a comment is drawn as in the Talk view (`.page-comment` in `PageComment.vue`), on the
      same surface (`.is-feedback-board` in `_page-chrome.scss`): its radius, its hairline, its faint
      two-layer shadow and its ink, and its inner spacing (`.page-comment-main`) -- so that a board's
      ideas and the discussions under them read as the same kind of thing. Kept in step by hand: the
      two are scoped to different components and share no class.
    */
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    background-color: #fff;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.04),
      0 2px 8px rgba(0, 0, 0, 0.04);
    color: #26292e;
    transition: border-color 0.2s ease;

    @at-root .body--dark & {
      border-color: rgba(255, 255, 255, 0.06);
      background-color: $dark-2;
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.3),
        0 2px 8px rgba(0, 0, 0, 0.2);
      color: rgba(255, 255, 255, 0.87);
    }

    /*
      The one thing a comment does not have: a comment is not a link, and an idea is. Its hairline
      takes the brand colour under the pointer, the vote box's own hover, with the faintest wash of it
      rising from the bottom over the card's own fill -- rather than the card lifting the way a blog's
      cards do, which would no longer match the comments.
    */
    /*
      A settled idea is tinted from its bottom-left corner in its status's colour -- the badge's
      (`FEEDBACK_STATUS_LOOK` in `helpers/pageFeedback.js`) -- so that what is done and what is turned
      down can be told apart down a long listing before any badge is read. The glow's shape is the page
      header's (`--page-header-glow` in `_page-chrome.scss`). A variable rather than a background of
      its own, so that the hover below can draw over it rather than replace it.
    */
    &.is-completed {
      --page-feedback-idea-tint: var(--color-emerald-600);
    }
    &.is-closed {
      --page-feedback-idea-tint: var(--color-red-8);
    }
    &.is-completed,
    &.is-closed {
      --page-feedback-idea-glow: radial-gradient(
        ellipse 55% 180% at 0% 100%,
        color-mix(
          in srgb,
          var(--page-feedback-idea-tint) var(--page-feedback-idea-tint-strength),
          transparent
        ),
        transparent
      );
      --page-feedback-idea-tint-strength: 7%;
      background-image: var(--page-feedback-idea-glow);

      /* -> A little more on the dark card, for the hover's reason below */
      @at-root .body--dark & {
        --page-feedback-idea-tint-strength: 10%;
      }
    }

    &:hover {
      border-color: var(--color-primary);
      background-image:
        linear-gradient(
          to top,
          color-mix(in srgb, var(--color-primary) 5%, transparent),
          transparent
        ),
        var(--page-feedback-idea-glow, none);

      /* -> A little more on the dark card, where the same share of colour barely registers */
      @at-root .body--dark & {
        background-image:
          linear-gradient(
            to top,
            color-mix(in srgb, var(--color-primary) 8%, transparent),
            transparent
          ),
          var(--page-feedback-idea-glow, none);
      }
    }

    &-body {
      display: flex;
      min-width: 0;
      flex: 1 1 auto;
      flex-direction: column;
    }

    &-title {
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.35;
    }

    &-desc {
      margin-top: 2px;
      font-size: 0.8rem;
      line-height: 1.4;
      opacity: 0.7;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    &-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
    }

    &-category {
      padding: 1px 7px;
      border-radius: 3px;
      font-size: 0.7rem;

      @at-root .body--light & {
        background-color: $grey-3;
      }
      @at-root .body--dark & {
        background-color: $dark-2;
      }
    }

    &-byline {
      font-size: 0.75rem;
      opacity: 0.55;
    }

    &-end {
      margin-inline-start: auto;
      white-space: nowrap;
    }

    /*
      The notch: tucked into the card's top-right corner, inside its hairline, so its outer corner is
      the card's own curve (8px less the 1px border) and its inner one a little rounder, for a tab of
      its size. A step darker than the card, in each theme's terms -- the light card is white and the
      dark one `dark-2`, one step lighter than `dark-3`.
    */
    &-comments {
      position: absolute;
      top: 0;
      inset-inline-end: 0;
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-start-end-radius: 7px;
      border-end-start-radius: 9px;
      background-color: $grey-2;
      font-size: 0.85rem;
      font-weight: 700;

      /*
        Up by what the speech bubble's tail pulls it down: the box is centred on the number, but the
        glyph's ink runs from 6 to 29.4 of its 32 units, so what the eye centres sits low. Measured,
        that is ~0.05em, but beside the bold digits the glyph still read low by that much, so it is
        raised further than the measurement says.
      */
      .w-icon {
        transform: translateY(-0.1em);
      }
      color: rgba(0, 0, 0, 0.6);

      @at-root .body--dark & {
        background-color: $dark-3;
        color: rgba(255, 255, 255, 0.6);
      }

      /*
        Tinted with the brand colour once somebody has said something, so an idea with a discussion
        stands out in the list. From `--color-primary` rather than `$primary`, which is the default
        and not what a re-themed site has set.
      */
      &.has-comments {
        background-color: color-mix(in srgb, var(--color-primary) 12%, white);
        color: var(--color-primary);

        @at-root .body--dark & {
          background-color: color-mix(in srgb, var(--color-primary) 22%, $dark-2);
          color: var(--color-primary-light);
        }
      }
    }

    /* -> Room at the end of the title for the notch, so a long one wraps before it rather than under */
    &.has-comments-notch .page-feedback-idea-title {
      padding-inline-end: 60px;
    }
  }

  &-pager {
    display: flex;
    justify-content: center;
    margin-top: 24px;
  }

  &-count {
    margin-top: 8px;
    text-align: center;
    font-size: 0.75rem;
    opacity: 0.55;
  }
}
</style>
