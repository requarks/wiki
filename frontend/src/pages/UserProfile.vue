<template>
  <w-layout>
    <w-header><header-nav /></w-header>
    <w-page-container class="layout-userprofile">
      <div class="layout-userprofile-inner">
        <w-btn
          class="layout-userprofile-back"
          icon="la:arrow-circle-left"
          color="white"
          flat
          round
          @click="goBack">
          <w-tooltip anchor="center left" self="center right">{{
            t('common.actions.goback')
          }}</w-tooltip>
        </w-btn>

        <!--
          IDENTITY
          ========
          Only ever what the person put on their own profile, so a field they left empty is left out
          rather than drawn as a row saying nothing.
        -->
        <w-card v-if="state.notFound" class="layout-userprofile-card">
          <w-card-section class="text-center">
            <w-icon name="la:user-slash" size="48px" class="text-grey" />
            <div class="mt-2 text-body1">{{ t('userProfile.notFound') }}</div>
          </w-card-section>
        </w-card>
        <w-card v-else class="layout-userprofile-card">
          <w-card-section class="layout-userprofile-identity">
            <w-avatar
              class="layout-userprofile-avatar"
              size="128px"
              :color="state.profile.hasAvatar ? `dark-1` : `primary`"
              text-color="white">
              <img v-if="state.profile.hasAvatar" :src="`/_user/${userId}/avatar`" alt="" />
              <w-icon v-else name="la:user" />
            </w-avatar>
            <div class="layout-userprofile-identity-text">
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 class="text-h6 leading-tight">{{ state.profile.name }}</h1>
                <span v-if="state.profile.pronouns" class="text-caption text-grey">{{
                  state.profile.pronouns
                }}</span>
              </div>
              <div v-if="state.profile.jobTitle" class="text-subtitle2 mt-1">
                {{ state.profile.jobTitle }}
              </div>
              <dl class="layout-userprofile-facts">
                <div v-if="state.profile.location">
                  <dt><w-icon name="la:map-marker" size="xs" />{{ t('userProfile.location') }}</dt>
                  <dd>{{ state.profile.location }}</dd>
                </div>
                <div v-if="localTime">
                  <dt><w-icon name="la:clock" size="xs" />{{ t('userProfile.localTime') }}</dt>
                  <dd>
                    {{ localTime }}
                    <span class="text-caption text-grey">{{ state.profile.timezone }}</span>
                  </dd>
                </div>
                <div v-if="state.profile.lastLoginAt">
                  <dt>
                    <w-icon name="la:sign-in-alt" size="xs" />{{ t('userProfile.lastLogin') }}
                  </dt>
                  <dd>{{ userStore.formatDateTime(t, state.profile.lastLoginAt) }}</dd>
                </div>
              </dl>
            </div>
          </w-card-section>
        </w-card>

        <!--
          CONTRIBUTIONS
          =============
          Three questions of the same person. What they started and what they touched last are two
          searches differing only in which column they filter on and which date they order and display
          by; what they said in discussions is a list of comments, each leading to the Talk view of its
          page and drawn as a line or two of what was said rather than as a page.
        -->
        <w-card v-if="!state.notFound" class="layout-userprofile-card mt-6">
          <w-card-section>
            <w-tabs v-model="state.tab" no-caps inline-label>
              <w-tab
                v-for="tab of tabs"
                :key="tab.name"
                :name="tab.name"
                :label="tab.label"
                :icon="tab.icon" />
            </w-tabs>
          </w-card-section>
          <w-tab-panels v-model="state.tab">
            <w-tab-panel v-for="tab of tabs" :key="tab.name" :name="tab.name">
              <div
                v-if="lists[tab.name].fetched && lists[tab.name].results.length < 1"
                class="p-6 text-center">
                <em class="text-grey">{{ tab.empty }}</em>
              </div>
              <w-list v-if="tab.name === `comments`" separator>
                <w-item
                  v-for="item of lists.comments.results"
                  :key="item.id"
                  clickable
                  :to="commentUrl(item)">
                  <w-item-section avatar>
                    <w-avatar color="primary" text-color="white" rounded>
                      <w-icon :name="item.parentId ? `la:reply` : `la:comment`" size="24px" />
                    </w-avatar>
                  </w-item-section>
                  <w-item-section>
                    <w-item-label
                      v-if="item.preview"
                      class="layout-userprofile-comment"
                      lines="2"
                      >{{ item.preview }}</w-item-label
                    >
                    <w-item-label v-else class="layout-userprofile-comment text-grey">
                      <em>{{ t('userProfile.commentAnnotationsOnly', item.annotationCount) }}</em>
                    </w-item-label>
                    <w-item-label caption>{{
                      item.parentId
                        ? t('userProfile.replyOn', { title: item.pageTitle })
                        : t('userProfile.commentOn', { title: item.pageTitle })
                    }}</w-item-label>
                    <w-item-label class="text-grey" caption>{{
                      pageUrl({ locale: item.pageLocale, path: item.pagePath })
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section side top>
                    <div class="text-caption text-right">
                      {{ userStore.formatDateTime(t, item.createdAt) }}
                    </div>
                  </w-item-section>
                </w-item>
              </w-list>
              <w-list v-else separator>
                <w-item
                  v-for="item of lists[tab.name].results"
                  :key="item.id"
                  clickable
                  :to="pageUrl(item)">
                  <w-item-section avatar>
                    <w-avatar color="primary" text-color="white" rounded>
                      <w-icon :name="item.icon || defaultPageIcon" size="24px" />
                    </w-avatar>
                  </w-item-section>
                  <w-item-section>
                    <w-item-label>{{ item.title }}</w-item-label>
                    <w-item-label v-if="item.description" caption>{{
                      item.description
                    }}</w-item-label>
                    <w-item-label class="text-grey" caption>{{ pageUrl(item) }}</w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <div class="text-caption text-right">
                      {{ userStore.formatDateTime(t, item[tab.dateField]) }}
                    </div>
                    <div class="mt-1 flex flex-wrap items-center justify-end gap-1">
                      <w-chip
                        v-for="tag of item.tags"
                        :key="`tag-` + tag"
                        square
                        color="secondary"
                        text-color="white"
                        icon="la:hashtag"
                        size="sm"
                        >{{ tag }}</w-chip
                      >
                    </div>
                  </w-item-section>
                </w-item>
              </w-list>
              <div v-if="lists[tab.name].offset < lists[tab.name].total" class="p-4 text-center">
                <w-btn
                  outline
                  no-caps
                  color="primary"
                  :label="t(`userProfile.loadMore`)"
                  :disable="lists[tab.name].loading > 0"
                  @click="fetchCurrent" />
              </div>
            </w-tab-panel>
          </w-tab-panels>
          <w-inner-loading :showing="lists[state.tab].loading > 0" />
        </w-card>
      </div>
      <w-footer><footer-nav /></w-footer>
    </w-page-container>
    <main-overlay-dialog />
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'
import { DEFAULT_PAGE_ICON } from '@/stores/page'

import HeaderNav from '@/components/HeaderNav.vue'
import FooterNav from '@/components/FooterNav.vue'
import MainOverlayDialog from '@/components/MainOverlayDialog.vue'
import { apiErrorMessage } from '@/helpers/apiError'
import { renderComment } from '@/renderers/comment'

/** How many pages one tab fetches at a time. Load More asks for the next batch of the same size. */
const PAGE_SIZE = 25

/**
 * How often the local-time line is recomputed.
 *
 * It shows hours and minutes, so a minute is the resolution -- and half of one is what keeps the
 * displayed minute at most 30 seconds stale without the page having to work out when the next one
 * starts.
 */
const CLOCK_INTERVAL = 30000

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const route = useRoute()
const router = useRouter()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  profile: {
    id: '',
    name: '',
    hasAvatar: false,
    location: '',
    jobTitle: '',
    pronouns: '',
    timezone: '',
    lastLoginAt: null
  },
  notFound: false,
  tab: 'created'
})

/**
 * One list per tab, fetched the first time its tab is looked at rather than all up front: a reader
 * arriving here is shown the pages this person created, and the other lists are more queries for
 * tabs that may never be opened.
 */
const lists = reactive({
  created: { results: [], total: 0, offset: 0, loading: 0, fetched: false },
  updated: { results: [], total: 0, offset: 0, loading: 0, fetched: false },
  comments: { results: [], total: 0, offset: 0, loading: 0, fetched: false }
})

/** The moment the clock line is drawn from, ticked by the interval below. */
const now = ref(Temporal.Now.instant())
let clockTimer = null

const defaultPageIcon = DEFAULT_PAGE_ICON

// COMPUTED

const userId = computed(() => route.params.userId)

/**
 * What separates the page tabs, in one place: which column the search filters on, and which of the two
 * dates it orders and labels the rows by. The comments tab is drawn and fetched by its own code, and
 * is only there on a site whose discussions are the wiki's own -- a third-party provider's comments
 * are not stored here to be listed.
 */
const tabs = computed(() => [
  {
    name: 'created',
    label: t('userProfile.pagesCreated'),
    icon: 'la:file-alt',
    empty: t('userProfile.noPagesCreated'),
    filter: 'creatorId',
    dateField: 'createdAt',
    orderBy: 'createdAt'
  },
  {
    name: 'updated',
    label: t('userProfile.pagesUpdated'),
    icon: 'la:history',
    empty: t('userProfile.noPagesUpdated'),
    filter: 'authorId',
    dateField: 'updatedAt',
    orderBy: 'updatedAt'
  },
  ...(siteStore.comments.isBuiltIn
    ? [
        {
          name: 'comments',
          label: t('userProfile.comments'),
          icon: 'la:comments',
          empty: t('userProfile.noComments')
        }
      ]
    : [])
])

const currentTab = computed(() => tabs.value.find((tb) => tb.name === state.tab))

/**
 * What time it is where this person is.
 *
 * Their zone decides the moment; the READER's 12h/24h preference decides how it is written, because
 * that is a preference about reading a clock and not about whose clock it is. A zone that no longer
 * resolves -- one renamed since they picked it -- leaves the line out rather than throwing mid-render.
 */
const localTime = computed(() => {
  if (!state.profile.timezone) {
    return null
  }
  try {
    return now.value
      .toZonedDateTimeISO(state.profile.timezone)
      .toLocaleString(
        undefined,
        userStore.timeFormat === '24h'
          ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
          : { hour: 'numeric', minute: '2-digit', hour12: true }
      )
  } catch {
    return null
  }
})

// META

useMeta(() => {
  const siteTitle = siteStore.title
  const name = state.profile.name || t('userProfile.title')
  return {
    title: name,
    titleTemplate: (title) => `${title} - ${siteTitle}`
  }
})

// WATCHERS

watch(
  userId,
  async (newValue) => {
    if (!newValue) {
      return
    }
    for (const list of Object.values(lists)) {
      Object.assign(list, { results: [], total: 0, offset: 0, fetched: false })
    }
    await fetchProfile()
    if (!state.notFound) {
      fetchCurrent()
    }
  },
  { immediate: true }
)

// -> A tab is fetched when it is first looked at, and never again
watch(
  () => state.tab,
  () => {
    if (!state.notFound && !lists[state.tab].fetched) {
      fetchCurrent()
    }
  }
)

// METHODS

/**
 * Where a page listed here leads.
 *
 * Per row rather than once for the list, as on the search screen: these are every locale this person
 * has written in, and a bare path is the primary locale's address.
 */
function pageUrl(item) {
  return `${siteStore.localeUrlPrefix(item.locale)}/${item.path}`
}

/** Where a comment listed here leads: the Talk view of its page, scrolled to it (`pages/Index.vue`). */
function commentUrl(item) {
  return `${pageUrl({ locale: item.pageLocale, path: item.pagePath })}#comment-${item.id}`
}

/**
 * What a comment row shows of the comment: its text with the markdown taken out, run together onto
 * one line for the row to cut at its second (`lines` on the label).
 *
 * Rendered rather than stripped by pattern, so that what is left is what a reader sees on the page --
 * the renderer already knows what is syntax. Parsed into an inert document to read the text back,
 * never into the live one: nothing in it is drawn as HTML.
 */
function commentPreview(excerpt) {
  const html = renderComment(excerpt)
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Back to wherever the reader came from, and to this locale's home when there is nowhere to go back
 * to -- a tab opened straight at this screen, a link followed from somewhere else.
 *
 * `history.state.back` is the entry vue-router itself records, and is the only thing that answers
 * whether there is one: `history.length` counts the whole tab and is never 0, so the fallback below
 * used to be unreachable and `router.back()` walked the reader out of the wiki instead. The fallback
 * is prefixed because a bare `/` is the PRIMARY locale's home whoever asks -- see `readerHomePath`.
 */
function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push(siteStore.readerHomePath)
  }
}

async function fetchProfile() {
  state.notFound = false
  try {
    const profile = await API_CLIENT.get(`users/${userId.value}/profile`).json()
    Object.assign(state.profile, profile)
  } catch (err) {
    // -> A profile nobody can be shown is the page's own empty state rather than a notification: the
    //    reader followed a link to a person, and what they need to be told is that there is none
    if (err?.response?.status === 404) {
      state.notFound = true
      return
    }
    notify({
      type: 'negative',
      message: t('userProfile.loadingFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

/**
 * Fetch one batch of the current tab's list, appending to what is already there.
 *
 * The listing is the page search with nothing to search for: the filters alone decide the results,
 * which is what makes it one endpoint rather than two. That also means it obeys the same rules --
 * a page this reader may not open is not listed, and neither is one marked as not searchable.
 */
async function fetchPages() {
  const tab = currentTab.value
  const list = lists[tab.name]
  list.loading++
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/search`, {
      searchParams: {
        [tab.filter]: userId.value,
        orderBy: tab.orderBy,
        orderByDirection: 'desc',
        offset: list.offset,
        limit: PAGE_SIZE
      }
    }).json()
    list.results.push(
      ...(resp?.results ?? []).map((r) => ({ ...r, tags: [...(r.tags ?? [])].sort() }))
    )
    /*
      The search applies this reader's page rules before it pages, so every batch but the last is
      full and `totalHits` counts only pages they may open -- never the ones they were refused.
    */
    list.offset += PAGE_SIZE
    list.total = resp?.totalHits ?? 0
    list.fetched = true
  } catch (err) {
    notify({
      type: 'negative',
      message: t('userProfile.pagesLoadingFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    list.loading--
  }
}

/**
 * Fetch one batch of this person's comments, appending to what is already there.
 *
 * The server settles which comments this reader may see before it pages -- the page rules of the page
 * each one is on -- so as with the page lists, every batch but the last is full and the total counts
 * nothing they were refused.
 */
async function fetchComments() {
  const list = lists.comments
  list.loading++
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/users/${userId.value}/comments`, {
      searchParams: { offset: list.offset, limit: PAGE_SIZE }
    }).json()
    list.results.push(
      ...(resp?.results ?? []).map((r) => ({ ...r, preview: commentPreview(r.excerpt) }))
    )
    list.offset += PAGE_SIZE
    list.total = resp?.total ?? 0
    list.fetched = true
  } catch (err) {
    notify({
      type: 'negative',
      message: t('userProfile.commentsLoadingFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    list.loading--
  }
}

/** Fetch the next batch of whichever list the open tab shows. */
function fetchCurrent() {
  if (state.tab === 'comments') {
    fetchComments()
  } else {
    fetchPages()
  }
}

// MOUNTED

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = Temporal.Now.instant()
  }, CLOCK_INTERVAL)
})

onUnmounted(() => {
  clearInterval(clockTimer)
})
</script>

<style lang="scss">
.layout-userprofile {
  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  /*
    The same tinted band the search and profile screens open with, so the three read as one family of
    full-screen cards. Fixed rather than scrolled with the content, as it is there.
  */
  &:before {
    content: '';
    height: 200px;
    position: fixed;
    top: 0;
    width: 100%;
    background: radial-gradient(ellipse at bottom, $dark-3, $dark-6);
    border-bottom: 1px solid #fff;

    @at-root .body--dark & {
      border-bottom-color: $dark-3;
    }
  }

  &:after {
    content: '';
    height: 1px;
    position: fixed;
    top: 64px;
    width: 100%;
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 100%
    );
  }

  /*
    Narrower than the search and profile cards' 1400px: this page is one column of prose-width content
    rather than a sidebar beside a list, and a 1400px identity card leaves its four facts marooned at
    either end of an empty band.
  */
  &-inner {
    position: relative;
    width: 90%;
    max-width: 900px;
    margin: 50px auto;
  }

  &-back {
    position: absolute;
    left: -50px;
  }

  &-identity {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.5rem;
  }

  /*
    `min-width` on the text column is what lets the row above actually wrap: with none, the column
    shrinks to nothing beside the avatar instead of taking a line of its own on a narrow screen.
  */
  &-identity-text {
    flex: 1 1 auto;
    min-width: 15rem;
  }

  /*
    A comment row's text, clamped to two lines by the label itself (`lines`). A comment can hold a URL
    or a run of characters with no break opportunity, which would otherwise widen the row rather than
    wrap onto the second line.
  */
  &-comment {
    overflow-wrap: anywhere;
  }

  &-avatar {
    // -> An uploaded avatar is a square image; the container's radius is what makes it a circle
    overflow: hidden;
  }

  /*
    The facts under the name: label above value, as many across as fit. A definition list because that
    is what it is -- each row names a thing and gives its value.
  */
  &-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 2rem;
    margin-top: 1rem;

    dt {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: var(--text-caption);
      letter-spacing: var(--text-caption--letter-spacing);
      text-transform: uppercase;
      color: $grey-7;

      @at-root .body--dark & {
        color: rgba(255, 255, 255, 0.55);
      }
    }

    dd {
      margin: 0;
      font-size: var(--text-body2);
      line-height: var(--text-body2--line-height);
    }
  }

  /*
    Below 1024px there is no gutter left to work with. The card's is 5% of the window on each side --
    it only stops being a percentage once the window is wider than the 900px cap -- so under 1000px it
    is narrower than the 50px the back button is offset by, and the button slides off the left edge of
    the screen. Stated at the breakpoint just above that, since a button half in the gutter is no
    better than one outside it.

    It is dropped rather than moved: inside the card the only place for it is on top of the avatar, and
    a reader on a narrow screen has both the browser's own back gesture and the header above it.
  */
  @media (max-width: $breakpoint-sm-max) {
    &-inner {
      width: 95%;
      margin: 25px auto;
    }

    &-back {
      display: none;
    }
  }
}
</style>
