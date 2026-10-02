<template>
  <w-page class="py-4">
    <div class="w-section-header flex items-center">
      <span>{{ t('inbox.inbox') }}</span>
      <w-space />
      <!--
        -> A dark tab notched into the card's top right corner, so its controls are drawn for a dark
           surface in both themes. See `.inbox-tab` for how it fills the corner without growing the
           heading.
      -->
      <div v-if="siteStore.features.notifications" class="inbox-tab">
        <w-toggle
          v-model="notificationsStore.unreadOnly"
          dense
          dark
          class="mr-4"
          :label="t(`inbox.unreadOnly`)"
          @update:model-value="reload" />
        <!--
          -> The tooltip is on a wrapper rather than on the button: a disabled button takes no pointer
             events, and the name is still worth showing when there is nothing to mark
        -->
        <span class="inline-flex" data-tooltip-anchor>
          <w-btn
            flat
            dense
            round
            icon="mdi:email-open-multiple-outline"
            color="white"
            :aria-label="t(`inbox.markAllRead`)"
            :disable="notificationsStore.unread < 1"
            @click="markAllRead" />
          <w-tooltip>{{ t('inbox.markAllRead') }}</w-tooltip>
        </span>
        <w-btn
          class="ml-2"
          flat
          dense
          round
          icon="la:cog"
          color="grey-4"
          to="/_profile/notifications"
          :aria-label="t(`inbox.settings`)">
          <w-tooltip>{{ t('inbox.settings') }}</w-tooltip>
        </w-btn>
      </div>
    </div>
    <div class="p-4">
      <w-banner
        v-if="!siteStore.features.notifications"
        rounded
        :class="dark.isActive ? `bg-dark-4 text-grey-4` : `bg-grey-2 text-grey-8`">
        {{ t('inbox.notificationsOff') }}
      </w-banner>
      <w-banner
        v-else-if="notificationsStore.listLoaded && notificationsStore.entries.length < 1"
        rounded
        :class="dark.isActive ? `bg-dark-4 text-grey-4` : `bg-grey-2 text-grey-8`">
        <div>
          {{ notificationsStore.unreadOnly ? t('inbox.noneUnread') : t('inbox.none') }}
        </div>
        <div class="text-caption mt-1 opacity-70">{{ t('inbox.noneHint') }}</div>
      </w-banner>
      <template v-else>
        <template v-for="group of groups" :key="group.key">
          <div class="inbox-day text-caption">{{ group.label }}</div>
          <w-list bordered separator class="mb-4">
            <w-item
              v-for="entry of group.entries"
              :key="entry.id"
              :clickable="Boolean(targetOf(entry))"
              :class="{ 'inbox-entry--unread': !entry.isRead }"
              @click="open(entry)">
              <w-item-section avatar>
                <w-avatar
                  :color="entry.isRead ? `grey-5` : `primary`"
                  text-color="white"
                  rounded
                  size="36px">
                  <w-icon :name="iconOf(entry)" size="20px" />
                </w-avatar>
              </w-item-section>
              <w-item-section>
                <w-item-label>
                  <i18n-t
                    :keypath="`notifications.messages.${entry.category}.${entry.variant}`"
                    tag="span"
                    scope="global">
                    <template #actor>
                      <strong>{{ entry.data.actorName || t('notifications.someone') }}</strong>
                    </template>
                    <template #page>
                      <strong>{{ entry.data.page?.title ?? '' }}</strong>
                    </template>
                  </i18n-t>
                </w-item-label>
                <w-item-label v-if="entry.data.excerpt" caption class="inbox-excerpt">
                  “{{ entry.data.excerpt }}”
                </w-item-label>
                <w-item-label caption>
                  <!-- -> Anchored on the date itself, or WTooltip climbs to the row's `.w-item` -->
                  <span data-tooltip-anchor>
                    {{ relativeDate(entry.updatedAt) }}
                    <w-tooltip>{{ userStore.formatDateTime(t, entry.updatedAt) }}</w-tooltip>
                  </span>
                  <template v-if="entry.count > 1">
                    &middot; {{ t('notifications.count', { count: entry.count }) }}
                  </template>
                  <template v-if="entry.data.origin">
                    &middot; {{ t(`notifications.origin.${entry.data.origin}`) }}
                  </template>
                  <template v-if="entry.data.page?.path">
                    &middot; /{{ entry.data.page.path }}
                  </template>
                </w-item-label>
              </w-item-section>
              <w-item-section side>
                <div class="flex flex-nowrap items-center">
                  <!-- -> `.stop` on both, so acting on an entry does not also follow it -->
                  <w-btn
                    v-if="!entry.isRead"
                    class="acrylic-btn"
                    flat
                    dense
                    icon="mdi:email-open-outline"
                    color="primary"
                    :aria-label="t(`inbox.markRead`)"
                    @click.stop="markRead(entry)">
                    <w-tooltip>{{ t('inbox.markRead') }}</w-tooltip>
                  </w-btn>
                  <w-btn
                    class="acrylic-btn ml-2"
                    flat
                    dense
                    icon="mdi:close"
                    color="grey"
                    :aria-label="t(`inbox.dismiss`)"
                    @click.stop="dismiss(entry)">
                    <w-tooltip>{{ t('inbox.dismiss') }}</w-tooltip>
                  </w-btn>
                </div>
              </w-item-section>
            </w-item>
          </w-list>
        </template>
        <div v-if="notificationsStore.next" class="flex justify-center">
          <w-btn
            flat
            no-caps
            color="primary"
            icon="mdi:chevron-down"
            :label="t(`inbox.loadMore`)"
            :loading="notificationsStore.listLoading"
            @click="loadMore" />
        </div>
      </template>
    </div>
    <w-inner-loading :showing="notificationsStore.listLoading && !notificationsStore.listLoaded" />
  </w-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { relativeDate } from '@/helpers/datetime'

import { useNotificationsStore } from '@/stores/notifications'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * The inbox: what this reader has been told about on this site, newest activity first, grouped by
 * day.
 *
 * Each entry's sentence is `notifications.messages.<category>.<variant>`, the same string the email
 * about it is written from, drawn from the snapshot the entry carries — so it still reads right after
 * the page has been renamed or deleted. Opening an entry marks it read and follows it; an entry about
 * a page that has gone has nowhere to lead and only says what happened.
 */

/** The categories whose entries lead to a page's discussion rather than to the page itself. */
const DISCUSSION_CATEGORIES = new Set(['watchedPageComment', 'commentReply', 'mention'])

/** The picture beside each kind of entry. Literal names, so that the build bundles them. */
const ICONS = {
  watchedPage: 'mdi:file-document-edit-outline',
  watchedPageComment: 'mdi:comment-text-outline',
  commentReply: 'mdi:reply-outline',
  mention: 'mdi:at',
  reviewRequested: 'mdi:clipboard-check-outline',
  pageCreated: 'mdi:file-plus-outline',
  pageDeleted: 'mdi:file-remove-outline'
}

// COMPOSABLES

const dark = useDark()

// ROUTER

const router = useRouter()

// STORES

const notificationsStore = useNotificationsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('inbox.inbox')
}))

// COMPUTED

/** The loaded entries under a heading per day, in the reader's own time zone. */
const groups = computed(() => {
  const zone = userStore.timezoneId()
  const today = Temporal.Now.plainDateISO(zone)
  const yesterday = today.subtract({ days: 1 })
  const result = []
  for (const entry of notificationsStore.entries) {
    const day = Temporal.Instant.from(entry.updatedAt).toZonedDateTimeISO(zone).toPlainDate()
    const key = day.toString()
    let group = result.find((g) => g.key === key)
    if (!group) {
      group = {
        key,
        label: day.equals(today)
          ? t('inbox.today')
          : day.equals(yesterday)
            ? t('inbox.yesterday')
            : userStore.formatDate(entry.updatedAt),
        entries: []
      }
      result.push(group)
    }
    group.entries.push(entry)
  }
  return result
})

// METHODS

function iconOf(entry) {
  return entry.variant === 'deleted' ? ICONS.pageDeleted : (ICONS[entry.category] ?? 'mdi:bell')
}

/**
 * Where an entry leads: the review it asks for, the discussion it is about, or the page. `/i/<id>`
 * rather than the path, because the page may have moved since — which is what an id link survives.
 */
function targetOf(entry) {
  if (entry.category === 'reviewRequested' && entry.data.submissionId) {
    return `/_inbox/review/${entry.data.submissionId}`
  }
  if (!entry.pageId) {
    return null
  }
  return {
    path: `/i/${entry.pageId}`,
    hash: DISCUSSION_CATEGORIES.has(entry.category) ? '#talk' : ''
  }
}

async function reload() {
  try {
    await notificationsStore.loadList()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

async function loadMore() {
  try {
    await notificationsStore.loadList({ append: true })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

async function markRead(entry) {
  try {
    await notificationsStore.markRead({ ids: [entry.id] })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.markReadFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

async function markAllRead() {
  try {
    await notificationsStore.markRead()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.markReadFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

async function dismiss(entry) {
  try {
    await notificationsStore.dismiss(entry.id)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.dismissFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

/** Follow an entry, marking it read on the way. Not awaited: the page need not wait for the write. */
function open(entry) {
  const target = targetOf(entry)
  if (!target) {
    return
  }
  if (!entry.isRead) {
    markRead(entry)
  }
  router.push(target)
}

// MOUNTED

onMounted(() => {
  if (siteStore.features.notifications) {
    reload()
  }
})
</script>

<style lang="scss" scoped>
/*
  The header's controls, as a folder tab hanging off the card's top edge.

  It stretches to the header's height and then pulls out past it with negative margins: up through
  the page's `py-4` to the card's top edge, right through the heading's 16px padding to the card's
  side, and down through its 6px padding to the hairline. Negative margins take nothing from the
  line it sits on, so the heading stays exactly as tall as on the other inbox sections -- level
  with the rail's first item.

  The angled edge is a mask on a piece hung off its left rather than a `clip-path` on the tab
  itself, which would also clip the card's corner radius and the buttons' focus rings. Its path
  rounds the free corner at the foot of the slant, and flares the top of it into the card's edge
  the way a browser tab meets its strip; `::after` is the same flare where the tab's bottom meets
  the card's right side. The mask is stretched to the tab's height, which is the 48 its viewBox
  is drawn at to within a pixel, so the curves come out round.
*/
.inbox-tab {
  --inbox-tab-bg: #{$dark-2};

  position: relative;
  align-self: stretch;
  display: flex;
  align-items: center;
  margin: -16px -16px -6px 0;
  padding: 0 12px 0 4px;
  border-top-right-radius: 7px;
  background-color: var(--inbox-tab-bg);
  color: #fff;

  // -> Overlaps the tab by a pixel, so no seam of the card shows through between the two
  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    right: calc(100% - 1px);
    width: 36px;
    background-color: var(--inbox-tab-bg);
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 48' preserveAspectRatio='none'%3E%3Cpath d='M0 0H36V48H32Q26 48 23.7 42.5L8.3 5.5Q6 0 0 0Z'/%3E%3C/svg%3E")
      no-repeat 0 0 / 100% 100%;
  }

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    right: 0;
    width: 6px;
    height: 6px;
    background: radial-gradient(circle at 0 100%, transparent 6px, var(--inbox-tab-bg) 6.5px);
  }

  // -> A shade up from the card in dark mode, where `dark-2` is barely apart from `dark-3`
  @at-root .body--dark & {
    --inbox-tab-bg: #{$dark-1};
  }
}

.inbox-day {
  margin: 0 0 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: $grey-7;

  @at-root .body--dark & {
    color: $grey-5;
  }
}

.inbox-entry--unread {
  background: linear-gradient(to right, rgba($primary, 0.08), transparent);

  @at-root .body--dark & {
    background: linear-gradient(to right, rgba($primary, 0.18), transparent);
  }
}

.inbox-excerpt {
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
