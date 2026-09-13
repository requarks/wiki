<template>
  <w-page class="py-4">
    <div class="w-section-header">{{ t('profile.myInfo') }}</div>
    <w-item v-if="!canEdit">
      <w-item-section>
        <w-card class="bg-negative rounded text-white" flat>
          <w-card-section class="items-center" horizontal>
            <w-card-section class="shrink-0 pr-0">
              <w-icon name="la:ban" size="lg" />
            </w-card-section>
            <w-card-section>
              <span>{{ t('profile.editDisabledTitle') }}</span>
              <div class="text-caption text-red-1">{{ t('profile.editDisabledDescription') }}</div>
            </w-card-section>
          </w-card-section>
        </w-card>
      </w-item-section>
    </w-item>
    <w-item>
      <blueprint-icon icon="contact" />
      <w-item-section>
        <w-item-label>{{ t(`profile.displayName`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.displayNameHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section>
        <w-input
          v-model="state.config.name"
          outlined
          dense
          hide-bottom-space
          :aria-label="t(`profile.displayName`)"
          :readonly="!canEdit" />
      </w-item-section>
    </w-item>
    <w-separator inset spaced="sm" />
    <w-item>
      <blueprint-icon icon="envelope" />
      <w-item-section>
        <w-item-label>{{ t(`profile.email`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.emailHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section>
        <w-input
          v-model="state.config.email"
          outlined
          dense
          :aria-label="t(`profile.email`)"
          readonly />
      </w-item-section>
    </w-item>
    <w-separator inset spaced="sm" />
    <!--
      The handle, which is NOT gated on `canEdit` like the name and the fields under it. No identity
      provider owns a wiki mention handle, so a wiki that keeps its names in step with a directory has
      no reason to stop anybody choosing one -- and with profile editing off this would otherwise be
      the one field nobody could ever fill in.
    -->
    <w-item>
      <blueprint-icon icon="rename" />
      <w-item-section>
        <w-item-label>{{ t(`profile.handle`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.handleHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section>
        <w-input
          v-model="state.config.handle"
          outlined
          dense
          hide-bottom-space
          prefix="@"
          maxlength="32"
          :aria-label="t(`profile.handle`)" />
      </w-item-section>
    </w-item>
    <w-separator inset spaced="sm" />
    <w-item>
      <blueprint-icon icon="address" />
      <w-item-section>
        <w-item-label>{{ t(`profile.location`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.locationHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section>
        <w-input
          v-model="state.config.location"
          outlined
          dense
          hide-bottom-space
          :aria-label="t(`profile.location`)"
          :readonly="!canEdit" />
      </w-item-section>
    </w-item>
    <w-separator inset spaced="sm" />
    <w-item>
      <blueprint-icon icon="new-job" />
      <w-item-section>
        <w-item-label>{{ t(`profile.jobTitle`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.jobTitleHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section>
        <w-input
          v-model="state.config.jobTitle"
          outlined
          dense
          hide-bottom-space
          :aria-label="t(`profile.jobTitle`)"
          :readonly="!canEdit" />
      </w-item-section>
    </w-item>
    <w-separator inset spaced="sm" />
    <w-item>
      <blueprint-icon icon="gender" />
      <w-item-section>
        <w-item-label>{{ t(`profile.pronouns`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.pronounsHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section>
        <w-input
          v-model="state.config.pronouns"
          outlined
          dense
          hide-bottom-space
          :aria-label="t(`profile.pronouns`)"
          :readonly="!canEdit" />
      </w-item-section>
    </w-item>
    <div class="w-section-header mt-6">{{ t('profile.preferences') }}</div>
    <w-item>
      <blueprint-icon icon="timezone" />
      <w-item-section>
        <w-item-label>{{ t(`profile.timezone`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.timezoneHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section>
        <!--
          The virtual-scroll props the previous control took are gone: WSelect renders its options
          directly. The timezone list is the longest in the app and the dropdown scrolls internally,
          so this trades a few hundred DOM nodes for a much simpler component.
        -->
        <w-select
          v-model="state.config.timezone"
          outlined
          :options="timezones"
          dense
          options-dense
          hide-bottom-space
          :aria-label="t(`admin.general.defaultTimezone`)" />
      </w-item-section>
    </w-item>
    <w-separator inset spaced="sm" />
    <w-item>
      <blueprint-icon icon="calendar" />
      <w-item-section>
        <w-item-label>{{ t(`profile.dateFormat`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.dateFormatHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section>
        <w-select
          v-model="state.config.dateFormat"
          outlined
          emit-value
          map-options
          dense
          hide-bottom-space
          :aria-label="t(`admin.general.defaultDateFormat`)"
          :options="dateFormats" />
      </w-item-section>
    </w-item>
    <w-separator inset spaced="sm" />
    <w-item>
      <blueprint-icon icon="clock" />
      <w-item-section>
        <w-item-label>{{ t(`profile.timeFormat`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.timeFormatHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section side>
        <w-btn-toggle
          v-model="state.config.timeFormat"
          push
          glossy
          no-caps
          toggle-color="primary"
          :options="timeFormats"
          :aria-label="t(`profile.timeFormat`)" />
      </w-item-section>
    </w-item>
    <w-separator inset spaced="sm" />
    <w-item>
      <blueprint-icon icon="light-on" />
      <w-item-section>
        <w-item-label>{{ t(`profile.appearance`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.appearanceHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section side>
        <w-btn-toggle
          v-model="state.config.appearance"
          push
          glossy
          no-caps
          toggle-color="primary"
          :options="appearances"
          :aria-label="t(`profile.appearance`)" />
      </w-item-section>
    </w-item>
    <div class="w-section-header mt-6">{{ t('profile.accessibility') }}</div>
    <w-item>
      <blueprint-icon icon="visualy-impaired" />
      <w-item-section>
        <w-item-label>{{ t(`profile.cvd`) }}</w-item-label>
        <w-item-label caption>{{ t(`profile.cvdHint`) }}</w-item-label>
      </w-item-section>
      <w-item-section side>
        <w-btn-toggle
          v-model="state.config.cvd"
          push
          glossy
          no-caps
          toggle-color="primary"
          :options="cvdChoices"
          :aria-label="t(`profile.cvd`)" />
      </w-item-section>
    </w-item>
    <!-- -> Always: the preferences and accessibility settings below are savable whether or not the
         information above is editable -->
    <div class="actions-bar mt-6">
      <w-btn
        icon="la:check"
        unelevated
        :label="t(`common.actions.saveChanges`)"
        color="secondary"
        :disable="state.loading > 0"
        @click="save" />
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'

import { apiErrorMessage } from '@/helpers/apiError'
import { loading } from '@/composables/loading'
import { computed, onMounted, reactive } from 'vue'

import { useAuthConfigStore } from '@/stores/authConfig'
import { useUserStore } from '@/stores/user'

// STORES

const authConfigStore = useAuthConfigStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('profile.myInfo')
}))

// DATA

const state = reactive({
  config: {
    name: '',
    email: '',
    handle: '',
    location: '',
    jobTitle: '',
    pronouns: '',
    timezone: '',
    dateFormat: '',
    timeFormat: '12h',
    appearance: 'site',
    cvd: 'none'
  },
  loading: 0
})

const dateFormats = [
  { value: '', label: t('profile.localeDefault') },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD' }
]
const timeFormats = [
  { value: '12h', label: t('admin.general.defaultTimeFormat12h') },
  { value: '24h', label: t('admin.general.defaultTimeFormat24h') }
]
const appearances = [
  { value: 'site', label: t('profile.appearanceDefault') },
  { value: 'light', label: t('profile.appearanceLight') },
  { value: 'dark', label: t('profile.appearanceDark') }
]
const cvdChoices = [
  { value: 'none', label: t('profile.cvdNone') },
  { value: 'protanopia', label: t('profile.cvdProtanopia') },
  { value: 'deuteranopia', label: t('profile.cvdDeuteranopia') },
  { value: 'tritanopia', label: t('profile.cvdTritanopia') }
]
const timezones = Intl.supportedValuesOf('timeZone')

const canEdit = computed(() => authConfigStore.allowProfileEditing)

// METHODS

/**
 * The profile is read from the server rather than from the user store: the store only holds what the
 * session carries (name, email, preferences), while the location / job title / pronouns live in the
 * user's metadata and are not part of it.
 */
async function fetchProfile() {
  state.loading++
  try {
    const profile = await API_CLIENT.get('users/profile').json()
    applyProfile(profile)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.infoLoadingFailed'),
      caption: err.message
    })
  }
  state.loading--
}

function applyProfile(profile) {
  state.config.name = profile.name || ''
  state.config.email = profile.email || ''
  state.config.handle = profile.handle || ''
  state.config.location = profile.location || ''
  state.config.jobTitle = profile.jobTitle || ''
  state.config.pronouns = profile.pronouns || ''
  // -> No stored time zone means "whatever the browser resolves"
  state.config.timezone = profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  state.config.dateFormat = profile.dateFormat || ''
  state.config.timeFormat = profile.timeFormat || '12h'
  state.config.appearance = profile.appearance || 'site'
  state.config.cvd = profile.cvd || 'none'
}

async function save() {
  loading.show({
    message: t('profile.saving')
  })
  try {
    /*
      The email is displayed read-only and cannot be changed here, so it is left out entirely — and
      so is everything an identity provider owns while profile editing is off, which the server
      refuses rather than ignores. What is left is this person's own settings, which are theirs to
      change either way.
    */
    const resp = await API_CLIENT.put('users/profile', {
      json: {
        ...(canEdit.value
          ? {
              name: state.config.name,
              location: state.config.location,
              jobTitle: state.config.jobTitle,
              pronouns: state.config.pronouns
            }
          : {}),
        handle: state.config.handle.trim(),
        timezone: state.config.timezone,
        dateFormat: state.config.dateFormat,
        timeFormat: state.config.timeFormat,
        appearance: state.config.appearance,
        cvd: state.config.cvd
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured')
    }
    if (resp.profile) {
      applyProfile(resp.profile)
    }
    // -> Only the fields the store actually holds: the appearance and CVD choices are watched by the
    //    app shell, so saving them takes effect right away
    userStore.$patch({
      name: state.config.name,
      timezone: state.config.timezone,
      dateFormat: state.config.dateFormat,
      timeFormat: state.config.timeFormat,
      appearance: state.config.appearance,
      cvd: state.config.cvd
    })
    notify({
      type: 'positive',
      message: t('profile.saveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.saveFailed'),
      // -> The server's own message, not ky's: a handle somebody else already has comes back as a
      //    sentence the person can act on, and `err.message` would replace it with "Request failed"
      caption: apiErrorMessage(err)
    })
  }
  loading.hide()
}

// MOUNTED

onMounted(() => {
  fetchProfile()
})
</script>
