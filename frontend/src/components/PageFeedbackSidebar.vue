<template>
  <div class="page-feedback-sidebar">
    <!-- Status -->
    <div class="p-4 flex items-center">
      <w-icon class="me-2" name="la:tasks" color="grey" />
      <div class="text-caption text-grey-7">{{ t('common.feedback.status') }}</div>
      <w-space />
      <!--
        Back to what the order shows by default, once the reader has picked by hand: a choice made
        here stops following the sort, and this is how it starts following it again.
      -->
      <w-btn
        v-if="filter.statuses"
        flat
        dense
        no-caps
        size="sm"
        color="primary"
        padding="none xs"
        :label="t('common.feedback.resetStatuses')"
        @click="resetStatuses" />
    </div>
    <!-- -> Spaced apart: each box carries a rim and a cast shadow, which ran into the next row's -->
    <div class="flex flex-col gap-2 px-4 pb-4">
      <div class="page-feedback-facet" v-for="entry of statusFacets" :key="entry.status">
        <w-checkbox
          :model-value="shownStatuses.includes(entry.status)"
          :label="t(`common.feedback.statuses.${entry.status}`)"
          @update:model-value="toggleStatus(entry.status, $event)" />
        <span class="page-feedback-facet-count">{{ entry.count }}</span>
      </div>
    </div>
    <!-- Categories -->
    <template v-if="settings.categories.length > 0">
      <w-separator />
      <div class="p-4 flex items-center">
        <w-icon class="me-2" name="la:tags" color="grey" />
        <div class="text-caption text-grey-7">{{ t('common.feedback.categories') }}</div>
      </div>
      <div class="px-4 pb-4">
        <!--
          One at a time, as links: a category is a narrowing of the board rather than a set of
          switches, and the one picked stays in place reading as pressed, since it is also the way back
          out of itself.
        -->
        <router-link
          class="page-feedback-category"
          :class="{ 'is-active': !filter.category }"
          :to="categoryLink(null)">
          {{ t('common.feedback.allCategories') }}
        </router-link>
        <router-link
          class="page-feedback-category"
          v-for="entry of feedbackState.facets.categories"
          :key="entry.tag"
          :class="{ 'is-active': filter.category === entry.tag }"
          :to="categoryLink(entry.tag)">
          {{ entry.label }}
          <span class="page-feedback-category-count">{{ entry.count }}</span>
        </router-link>
        <router-link
          class="page-feedback-category"
          :class="{ 'is-active': filter.category === 'none' }"
          :to="categoryLink('none')">
          {{ t('common.feedback.uncategorized') }}
          <span class="page-feedback-category-count">{{ feedbackState.facets.uncategorized }}</span>
        </router-link>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { feedbackState } from '@/composables/feedback'

import { feedbackFilterFromQuery, feedbackFilterQuery } from '@/helpers/feedbackFilter'
import { FEEDBACK_STATUSES, defaultStatusesFor, parseBoard } from '@/helpers/pageFeedback'

import { usePageStore } from '@/stores/page'

/**
 * The column beside a feedback board's listing: where its ideas stand, and what they are about.
 *
 * It replaces the contents/tags/rating column on a board's front page, as `PageBlogSidebar.vue` does on
 * a blog's. The counts come from the same request the listing does (`composables/feedback.js`), and
 * are counted before the status and category filters — so ticking a status off never takes its count,
 * and the box to tick it back on, away with it.
 */

// STORES

const pageStore = usePageStore()

// ROUTER

const route = useRoute()
const router = useRouter()

// I18N

const { t } = useI18n()

// COMPUTED

const settings = computed(() => parseBoard(pageStore.content))

const filter = computed(() => feedbackFilterFromQuery(route.query))

/** Every status, with its count once the listing has one, so the six rows never jump in and out. */
const statusFacets = computed(() =>
  FEEDBACK_STATUSES.map((status) => ({
    status,
    count: feedbackState.facets.statuses.find((entry) => entry.status === status)?.count ?? 0
  }))
)

/**
 * The statuses ticked: the reader's own pick, or what the order shows by default. Worked out here as
 * well as answered by the server, so that the boxes do not flicker to the old sort's defaults while
 * the listing for the new one is on its way.
 */
const shownStatuses = computed(
  () => filter.value.statuses ?? defaultStatusesFor(filter.value.sort ?? settings.value.sort)
)

// METHODS

/**
 * Tick or untick one status. The result is the reader's own choice from then on, written into the
 * URL in full. Unticking the last one ticks every status instead: a listing of nothing is not a
 * selection anybody makes on purpose, and the empty state would leave no box in sight to undo it.
 */
function toggleStatus(status, on) {
  const next = on
    ? FEEDBACK_STATUSES.filter((entry) => entry === status || shownStatuses.value.includes(entry))
    : shownStatuses.value.filter((entry) => entry !== status)
  router.push({
    path: route.path,
    query: feedbackFilterQuery({
      ...filter.value,
      statuses: next.length > 0 ? next : [...FEEDBACK_STATUSES]
    })
  })
}

function resetStatuses() {
  router.push({ path: route.path, query: feedbackFilterQuery({ ...filter.value, statuses: null }) })
}

/** Picking the category already selected clears it, so the list is its own way back out. */
function categoryLink(tag) {
  const next = tag && filter.value.category === tag ? null : tag
  return { path: route.path, query: feedbackFilterQuery({ ...filter.value, category: next }) }
}
</script>

<style lang="scss">
.page-feedback-sidebar {
  /*
    The ink of the column, stated here because nothing above states it: the status checkboxes take
    the surface's colour for their labels, and this column beside the listing declares none of its
    own -- left alone, they came out dark on the dark theme's surface.
  */
  @at-root .body--light & {
    color: rgba(0, 0, 0, 0.75);
  }
  @at-root .body--dark & {
    color: rgba(255, 255, 255, 0.75);
  }

  .page-feedback-facet {
    display: flex;
    align-items: center;
    justify-content: space-between;

    &-count {
      font-size: 0.72rem;
      opacity: 0.55;
      font-variant-numeric: tabular-nums;
    }
  }

  .page-feedback-category {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
    text-decoration: none;

    @at-root .body--light & {
      color: rgba(0, 0, 0, 0.75);
    }
    @at-root .body--dark & {
      color: rgba(255, 255, 255, 0.75);
    }
    &:hover {
      @at-root .body--light & {
        background-color: $grey-3;
      }
      @at-root .body--dark & {
        background-color: $dark-3;
      }
    }
    &.is-active {
      color: var(--color-primary);
      font-weight: 500;
    }

    &-count {
      padding-inline-start: 8px;
      font-size: 0.7rem;
      opacity: 0.55;
    }
  }
}
</style>
