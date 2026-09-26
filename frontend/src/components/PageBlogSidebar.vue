<template>
  <div class="page-blog-sidebar">
    <!-- Tags -->
    <template v-if="showTags">
      <div class="p-4 flex items-center">
        <w-icon class="me-2" name="la:tags" color="grey" />
        <div class="text-caption text-grey-7">{{ t('common.blog.tags') }}</div>
      </div>
      <div class="px-4 pb-4">
        <!--
          A cloud rather than a list: the counts are what make a blog's tags worth scanning, and a
          column of rows carrying one number each is a lot of height for that. The selected one stays
          in place and reads as pressed, because it is also the way back out of itself.
        -->
        <router-link
          class="page-blog-tag"
          v-for="entry of blogState.facets.tags"
          :key="entry.tag"
          :class="{ 'is-active': filter.tag === entry.tag }"
          :to="tagLink(entry.tag)">
          {{ entry.tag }}
          <span class="page-blog-tag-count">{{ entry.count }}</span>
        </router-link>
      </div>
    </template>
    <!-- Archive -->
    <template v-if="showArchive">
      <w-separator v-if="showTags" />
      <div class="p-4 flex items-center">
        <w-icon class="me-2" name="la:calendar-alt" color="grey" />
        <div class="text-caption text-grey-7">{{ t('common.blog.archive') }}</div>
      </div>
      <div class="px-4 pb-4">
        <!--
          Years, each opening onto its own months. The year is a filter in its own right as well as a
          heading -- a reader wanting "everything from 2025" should not have to pick twelve months --
          so the row is a link and the chevron beside it is what opens the list.
        -->
        <div class="page-blog-year" v-for="year of years" :key="year.year">
          <div class="page-blog-year-row">
            <!-- -> `color` and not the inherited text colour: this column states its own ink per
                    theme for the rows, and a button left to inherit drew the chevron in the
                    document's black and vanished against the dark surface -->
            <w-btn
              class="page-blog-year-toggle"
              flat
              dense
              size="sm"
              color="grey"
              :icon="isOpen(year.year) ? `la:angle-down` : collapsedIcon"
              :aria-label="t(`common.blog.toggleYear`, { year: year.year })"
              :aria-expanded="isOpen(year.year)"
              @click="toggleYear(year.year)" />
            <router-link
              class="page-blog-month is-year"
              :class="{ 'is-active': filter.year === year.year && !filter.month }"
              :to="archiveLink(year.year, null)">
              {{ year.year }}
              <span class="page-blog-month-count">{{ year.count }}</span>
            </router-link>
          </div>
          <div class="page-blog-months" v-if="isOpen(year.year)">
            <router-link
              class="page-blog-month"
              v-for="entry of year.months"
              :key="entry.month"
              :class="{ 'is-active': filter.year === year.year && filter.month === entry.month }"
              :to="archiveLink(year.year, entry.month)">
              {{ monthName(entry.month) }}
              <span class="page-blog-month-count">{{ entry.count }}</span>
            </router-link>
          </div>
        </div>
      </div>
    </template>
    <!--
      A blog with nothing in it yet has neither a tag nor a month, so both sections above are empty
      and the column would be a blank strip beside the listing. It says why instead.
    -->
    <div class="p-4 text-caption text-grey-6" v-if="!showTags && !showArchive && blogState.loaded">
      {{ t('common.blog.noFacets') }}
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { blogState } from '@/composables/blog'

import { blogFilterFromQuery, blogFilterQuery } from '@/helpers/blogFilter'
import { parseBlog } from '@/helpers/pageBlog'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * The column beside a blog's listing: what the blog is about, and when it was written.
 *
 * It replaces the contents/tags/rating column on a blog's front page, which has none of those to
 * offer — there are no headings to list, the front page's own tags are not the blog's, and a page
 * with no body is not something to rate.
 *
 * The facets come from the same request the listing does (`composables/blog.js`), so a count here can
 * never disagree with the posts next to it — and they describe the WHOLE blog rather than the
 * filtered set, which is what keeps a tag from disappearing the moment it is picked and stranding the
 * reader inside a filter they cannot see the way out of.
 */

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// ROUTER

const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

/**
 * Which years are open, by year.
 *
 * Local rather than in the URL: it is how the reader is looking at the list, not what they are
 * looking at, so it has no business in a link somebody else opens.
 */
const openYears = reactive(new Set())

// COMPUTED

/** A closed year's chevron points along the line, which on a right-to-left page is to the left. */
const collapsedIcon = computed(() =>
  siteStore.localeDir(pageStore.locale) === 'rtl' ? 'la:angle-left' : 'la:angle-right'
)

const settings = computed(() => parseBlog(pageStore.content))

const filter = computed(() => blogFilterFromQuery(route.query))

/** Both halves are asked twice: the blog has to want the section AND have something to put in it. */
const showTags = computed(() => settings.value.sidebar.tags && blogState.facets.tags.length > 0)

const showArchive = computed(
  () => settings.value.sidebar.archive && blogState.facets.archive.length > 0
)

/**
 * The archive as years holding months, newest first.
 *
 * The server answers one row per month, which is the shape a count comes in; a reader browses by
 * year, so the grouping is done here rather than sent twice. The year's own count is its months
 * added up, so the two can never say different things.
 */
const years = computed(() => {
  const grouped = new Map()
  for (const entry of blogState.facets.archive) {
    if (!grouped.has(entry.year)) {
      grouped.set(entry.year, { year: entry.year, count: 0, months: [] })
    }
    const year = grouped.get(entry.year)
    year.count += entry.count
    year.months.push({ month: entry.month, count: entry.count })
  }
  return [...grouped.values()]
    .sort((a, b) => b.year - a.year)
    .map((year) => ({ ...year, months: year.months.sort((a, b) => b.month - a.month) }))
})

// METHODS

/**
 * Whether a year's months are shown.
 *
 * The year being filtered on is always open, whether or not anybody clicked it: a reader who arrived
 * on a link to March 2026 must be able to see which month of the year they are in.
 */
function isOpen(year) {
  return openYears.has(year) || filter.value.year === year
}

function toggleYear(year) {
  if (openYears.has(year)) {
    openYears.delete(year)
  } else {
    openYears.add(year)
  }
}

/** Picking the tag already selected clears it, so the cloud is its own way back out. */
function tagLink(tag) {
  const next = filter.value.tag === tag ? null : tag
  return { path: route.path, query: blogFilterQuery({ ...filter.value, tag: next }) }
}

/** Likewise for a month, and for a year picked while that year is already the whole selection. */
function archiveLink(year, month) {
  const isCurrent = filter.value.year === year && (filter.value.month ?? null) === month
  return {
    path: route.path,
    query: blogFilterQuery({
      tag: filter.value.tag,
      year: isCurrent ? null : year,
      month: isCurrent ? null : month
    })
  }
}

/**
 * A month's name on its own. Built from the 15th rather than the 1st: the archive counts months in
 * UTC, and midnight on the first falls into the previous month for every reader west of Greenwich.
 */
function monthName(month) {
  return new Date(Date.UTC(2000, month - 1, 15)).toLocaleString(undefined, {
    month: 'long',
    timeZone: 'UTC'
  })
}
</script>

<style lang="scss">
.page-blog-sidebar {
  /* -> A cloud: every tag inline, wrapping, with its count tucked behind it */
  .page-blog-tag {
    display: inline-flex;
    align-items: baseline;
    margin: 0 4px 4px 0;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 0.75rem;
    text-decoration: none;
    transition: background-color 0.2s ease;

    @at-root .body--light & {
      background-color: $grey-3;
      color: rgba(0, 0, 0, 0.75);
    }
    @at-root .body--dark & {
      background-color: $dark-3;
      color: rgba(255, 255, 255, 0.75);
    }
    &:hover {
      @at-root .body--light & {
        background-color: $grey-4;
      }
      @at-root .body--dark & {
        background-color: $dark-2;
      }
    }
    &.is-active {
      background-color: $primary;
      color: #fff;
    }

    &-count {
      padding-inline-start: 5px;
      font-size: 0.65rem;
      opacity: 0.6;
    }
  }

  .page-blog-year {
    &-row {
      display: flex;
      align-items: center;
    }

    /* -> Squared off and small: it is a disclosure triangle, not a button in its own right */
    &-toggle {
      flex: 0 0 auto;
      min-width: 0;
      margin-inline-end: 2px;
      padding: 0 2px;
    }
  }

  .page-blog-months {
    padding-inline-start: 26px;
  }

  .page-blog-month {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 0.78rem;
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
      color: $primary;
      font-weight: 500;
    }
    &.is-year {
      flex: 1 1 auto;
      font-weight: 500;
    }

    &-count {
      padding-inline-start: 8px;
      font-size: 0.68rem;
      opacity: 0.55;
    }
  }
}
</style>
