<template>
  <w-page class="py-4">
    <div class="w-section-header">{{ t('inbox.watching') }}</div>
    <div class="p-4">
      <div class="text-body2">{{ t('inbox.watchingInfo') }}</div>
      <!--
        The empty state carries the instruction with it: this screen is reached from the sidebar, quite
        possibly before the reader has ever noticed the bell it is telling them about.
      -->
      <w-banner
        v-if="state.pages.length < 1 && state.loading < 1"
        class="mt-6"
        rounded
        :class="dark.isActive ? `bg-dark-4 text-grey-4` : `bg-grey-2 text-grey-8`">
        <div>{{ t('inbox.watchingNone') }}</div>
        <div class="text-caption mt-1 opacity-70">{{ t('inbox.watchingHint') }}</div>
      </w-banner>
      <w-list v-else class="mt-6" bordered separator>
        <w-item v-for="page of state.pages" :key="page.pageId" clickable @click="openPage(page)">
          <w-item-section avatar>
            <!--
              The page's own icon, which is what it is recognised by everywhere else. It is a reference
              a USER picked, so it resolves through `/_icons` rather than the bundled set — see WIcon.
            -->
            <w-avatar color="secondary" text-color="white" rounded>
              <w-icon :name="page.icon || DEFAULT_PAGE_ICON" />
            </w-avatar>
          </w-item-section>
          <w-item-section>
            <w-item-label>
              <strong>{{ page.title }}</strong>
            </w-item-label>
            <w-item-label caption>/{{ page.path }}</w-item-label>
            <w-item-label caption>
              {{ t('inbox.watchingUpdated', { date: humanizeDate(page.updatedAt) }) }}
              &middot;
              {{ t('inbox.watchingSince', { date: humanizeDate(page.watchedAt) }) }}
            </w-item-label>
          </w-item-section>
          <w-item-section side>
            <!--
              `@click.stop`, so pressing Stop Watching does not also follow the row to the page it is
              about — which would leave the reader on a page they just said they were done with.
            -->
            <!-- -> `mdi`, to match the bell this is the undoing of; see the page header -->
            <w-btn
              class="acrylic-btn"
              flat
              dense
              icon="mdi:bell-off-outline"
              color="grey"
              :aria-label="t(`inbox.watchingUnwatch`)"
              :disable="state.unwatching === page.pageId"
              @click.stop="unwatch(page)">
              <w-tooltip>{{ t('inbox.watchingUnwatch') }}</w-tooltip>
            </w-btn>
          </w-item-section>
        </w-item>
      </w-list>
    </div>
  </w-page>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'

import { DEFAULT_PAGE_ICON, usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// COMPOSABLES

const dark = useDark()

// ROUTER

const router = useRouter()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('inbox.watching')
})

// DATA

const state = reactive({
  loading: 0,
  pages: [],
  /** The page whose Stop Watching is in flight, so its button cannot be pressed twice. */
  unwatching: null
})

// MOUNTED

onMounted(load)

// METHODS

/** The reason the API gave, out of a response ky threw on, or the error's own message. */
async function apiMessage(err) {
  return (
    (await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)) ?? err.message
  )
}

function humanizeDate(val) {
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

async function load() {
  state.loading++
  try {
    state.pages = (await API_CLIENT.get(`sites/${siteStore.id}/watching`).json()) ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.watchingLoadFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading--
}

function openPage(page) {
  router.push(`/${page.path}`)
}

/**
 * Stop watching a page from the list.
 *
 * The row goes as soon as the server confirms, rather than the whole list being fetched again: what
 * changed is known exactly, and a reader unwatching three pages in a row should not watch the list
 * rebuild three times.
 *
 * The page store is kept in step for the one case where it is about the same page — the reader came
 * here from it, and going back must not find a bell still saying it is watched.
 */
async function unwatch(page) {
  state.unwatching = page.pageId
  try {
    await API_CLIENT.delete(`sites/${siteStore.id}/pages/${page.pageId}/watch`)
    state.pages = state.pages.filter((p) => p.pageId !== page.pageId)
    if (pageStore.id === page.pageId) {
      pageStore.$patch({ isWatching: false })
    }
    notify({
      type: 'positive',
      message: t('inbox.watchingUnwatched', { title: page.title })
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.watchingUnwatchFailed'),
      caption: await apiMessage(err)
    })
  }
  state.unwatching = null
}
</script>
