<template>
  <w-page class="py-4">
    <div class="w-section-header">{{ t('profile.notifications') }}</div>
    <div class="px-4 pt-4">
      <div class="text-body2">{{ t('profile.notificationsInfo') }}</div>
    </div>
    <!--
      Said rather than hidden: the preferences are the person's for every site, so they stay editable
      here, and what this site does with them is what the banner explains.
    -->
    <w-item v-if="!siteStore.features.notifications">
      <w-item-section>
        <w-banner rounded class="bg-warning text-white">
          {{ t('profile.notificationsSiteOff') }}
        </w-banner>
      </w-item-section>
    </w-item>
    <w-item v-if="!state.emailAvailable && state.loaded">
      <w-item-section>
        <w-banner
          rounded
          :class="dark.isActive ? `bg-dark-4 text-grey-4` : `bg-grey-2 text-grey-8`">
          {{ t('profile.notificationsNoEmail') }}
        </w-banner>
      </w-item-section>
    </w-item>

    <template v-for="section of sections" :key="section.key">
      <div class="w-section-header mt-6">{{ t(`notifications.sections.${section.key}`) }}</div>
      <template v-for="(pref, idx) of section.prefs" :key="pref.key">
        <w-separator v-if="idx > 0" inset spaced="sm" />
        <w-item>
          <blueprint-icon :icon="CATEGORY_ICONS[pref.key] ?? `inbox`" />
          <w-item-section>
            <w-item-label>{{ t(`notifications.categories.${pref.key}.title`) }}</w-item-label>
            <w-item-label caption>
              {{ t(`notifications.categories.${pref.key}.description`) }}
            </w-item-label>
          </w-item-section>
          <w-item-section side>
            <div class="flex flex-nowrap items-center gap-4">
              <w-toggle
                v-model="pref.inApp"
                dense
                :label="t(`profile.notificationsInApp`)"
                :aria-label="`${t(`notifications.categories.${pref.key}.title`)}: ${t(`profile.notificationsInApp`)}`" />
              <w-toggle
                v-model="pref.email"
                dense
                :disable="!state.emailAvailable"
                :label="t(`profile.notificationsEmail`)"
                :aria-label="`${t(`notifications.categories.${pref.key}.title`)}: ${t(`profile.notificationsEmail`)}`" />
            </div>
          </w-item-section>
        </w-item>
      </template>
    </template>

    <div class="actions-bar mt-6">
      <w-btn
        class="acrylic-btn self-center"
        icon="la:envelope-open"
        flat
        size="sm"
        :label="t(`profile.notificationsStopEmail`)"
        color="pink"
        :disable="state.loading > 0 || !state.emailAvailable"
        @click="stopAllEmail" />
      <w-space />
      <w-btn
        icon="la:check"
        unelevated
        :label="t(`common.actions.saveChanges`)"
        color="secondary"
        :disable="state.loading > 0"
        @click="save" />
    </div>

    <w-inner-loading :showing="state.loading > 0" />
  </w-page>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

import { useSiteStore } from '@/stores/site'

/**
 * Profile → Notifications: what this person is told about, and how.
 *
 * One row per category the server offers them, each with an In-App and an Email switch; both off is
 * how somebody says "never". The categories, their headings and their defaults all come from the
 * server (`notifications/index.ts`), so a category added there appears here without a change — what
 * this file knows of them is a picture for each, and the strings, which are keyed by category.
 *
 * One set of preferences for every site, which is why this sits in the profile rather than in a site.
 */

/** The picture beside each category. One that has none gets the inbox. */
const CATEGORY_ICONS = {
  watchedPage: 'activity-feed',
  watchedPageComment: 'comments',
  commentReply: 'chat',
  mention: 'contact',
  reviewRequested: 'todo-list',
  pageCreated: 'new-document',
  pageDeleted: 'trash'
}

// COMPOSABLES

const dark = useDark()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('profile.notifications')
}))

// DATA

const state = reactive({
  prefs: [],
  emailAvailable: false,
  loaded: false,
  loading: 0
})

// COMPUTED

/** The rows grouped under their headings, in the order the server sent them in. */
const sections = computed(() => {
  const grouped = []
  for (const pref of state.prefs) {
    let section = grouped.find((s) => s.key === pref.section)
    if (!section) {
      section = { key: pref.section, prefs: [] }
      grouped.push(section)
    }
    section.prefs.push(pref)
  }
  return grouped
})

// METHODS

function apply(resp) {
  state.prefs = resp.preferences ?? []
  state.emailAvailable = resp.emailAvailable ?? false
  state.loaded = true
}

async function load() {
  state.loading++
  try {
    apply(await API_CLIENT.get('users/profile/notifications').json())
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.notificationsLoadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

async function save() {
  state.loading++
  try {
    const preferences = Object.fromEntries(
      state.prefs.map((pref) => [pref.key, { inApp: pref.inApp, email: pref.email }])
    )
    apply(await API_CLIENT.put('users/profile/notifications', { json: { preferences } }).json())
    notify({
      type: 'positive',
      message: t('profile.notificationsSaved')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.notificationsSaveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

/** Every email switch off, and saved — the same thing the unsubscribe page offers. */
async function stopAllEmail() {
  for (const pref of state.prefs) {
    pref.email = false
  }
  await save()
}

// MOUNTED

onMounted(load)
</script>
