<template lang="pug">
q-page.q-py-md(:style-fn='pageStyle')
  .text-header {{t('profile.myInfo')}}
  q-item(v-if='!canEdit')
    q-item-section
      q-card.bg-negative.text-white.rounded-borders(flat)
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-ban', size='sm')
          q-card-section
            span {{ t('profile.editDisabledTitle') }}
            .text-caption.text-red-1 {{ t('profile.editDisabledDescription') }}
  q-item
    blueprint-icon(icon='contact')
    q-item-section
      q-item-label {{t(`profile.displayName`)}}
      q-item-label(caption) {{t(`profile.displayNameHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='state.config.name'
        dense
        hide-bottom-space
        :aria-label='t(`profile.displayName`)'
        :readonly='!canEdit'
        )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='envelope')
    q-item-section
      q-item-label {{t(`profile.email`)}}
      q-item-label(caption) {{t(`profile.emailHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='state.config.email'
        dense
        :aria-label='t(`profile.email`)'
        readonly
        )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='address')
    q-item-section
      q-item-label {{t(`profile.location`)}}
      q-item-label(caption) {{t(`profile.locationHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='state.config.location'
        dense
        hide-bottom-space
        :aria-label='t(`profile.location`)'
        :readonly='!canEdit'
        )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='new-job')
    q-item-section
      q-item-label {{t(`profile.jobTitle`)}}
      q-item-label(caption) {{t(`profile.jobTitleHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='state.config.jobTitle'
        dense
        hide-bottom-space
        :aria-label='t(`profile.jobTitle`)'
        :readonly='!canEdit'
        )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='gender')
    q-item-section
      q-item-label {{t(`profile.pronouns`)}}
      q-item-label(caption) {{t(`profile.pronounsHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='state.config.pronouns'
        dense
        hide-bottom-space
        :aria-label='t(`profile.pronouns`)'
        :readonly='!canEdit'
        )
  .text-header.q-mt-lg {{t('profile.preferences')}}
  q-item
    blueprint-icon(icon='timezone')
    q-item-section
      q-item-label {{t(`profile.timezone`)}}
      q-item-label(caption) {{t(`profile.timezoneHint`)}}
    q-item-section
      q-select(
        outlined
        v-model='state.config.timezone'
        :options='timezones'
        :virtual-scroll-slice-size='100'
        :virtual-scroll-slice-ratio-before='2'
        :virtual-scroll-slice-ratio-after='2'
        dense
        options-dense
        :aria-label='t(`admin.general.defaultTimezone`)'
        :readonly='!canEdit'
      )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='calendar')
    q-item-section
      q-item-label {{t(`profile.dateFormat`)}}
      q-item-label(caption) {{t(`profile.dateFormatHint`)}}
    q-item-section
      q-select(
        outlined
        v-model='state.config.dateFormat'
        emit-value
        map-options
        dense
        :aria-label='t(`admin.general.defaultDateFormat`)'
        :options='dateFormats'
        :readonly='!canEdit'
      )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='clock')
    q-item-section
      q-item-label {{t(`profile.timeFormat`)}}
      q-item-label(caption) {{t(`profile.timeFormatHint`)}}
    q-item-section.col-auto
      q-btn-toggle(
        v-model='state.config.timeFormat'
        push
        glossy
        no-caps
        toggle-color='primary'
        :options='timeFormats'
        :disable='!canEdit'
      )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='light-on')
    q-item-section
      q-item-label {{t(`profile.appearance`)}}
      q-item-label(caption) {{t(`profile.appearanceHint`)}}
    q-item-section.col-auto
      q-btn-toggle(
        v-model='state.config.appearance'
        push
        glossy
        no-caps
        toggle-color='primary'
        :options='appearances'
        :disable='!canEdit'
      )
  .text-header.q-mt-lg {{t('profile.accessibility')}}
  q-item
    blueprint-icon(icon='visualy-impaired')
    q-item-section
      q-item-label {{t(`profile.cvd`)}}
      q-item-label(caption) {{t(`profile.cvdHint`)}}
    q-item-section.col-auto
      q-btn-toggle(
        v-model='state.config.cvd'
        push
        glossy
        no-caps
        toggle-color='primary'
        :options='cvdChoices'
        :disable='!canEdit'
      )
  .actions-bar.q-mt-lg(v-if='canEdit')
    q-btn(
      icon='las la-check'
      unelevated
      :label='t(`common.actions.saveChanges`)'
      color='secondary'
      :disable='state.loading > 0'
      @click='save'
    )
</template>

<script setup>


import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive } from 'vue'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('profile.myInfo')
})

// DATA

const state = reactive({
  config: {
    name: '',
    email: '',
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

const canEdit = computed(() => siteStore.features?.profile)

// METHODS

function pageStyle (offset, height) {
  return {
    'min-height': `${height - 100 - offset}px`
  }
}

/**
 * The profile is read from the server rather than from the user store: the store only holds what the
 * session carries (name, email, preferences), while the location / job title / pronouns live in the
 * user's metadata and are not part of it.
 */
async function fetchProfile () {
  state.loading++
  try {
    const profile = await API_CLIENT.get('users/profile').json()
    applyProfile(profile)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('profile.infoLoadingFailed'),
      caption: err.message
    })
  }
  state.loading--
}

function applyProfile (profile) {
  state.config.name = profile.name || ''
  state.config.email = profile.email || ''
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

async function save () {
  $q.loading.show({
    message: t('profile.saving')
  })
  try {
    // -> The email is displayed read-only and cannot be changed here, so it is left out entirely
    const resp = await API_CLIENT.put('users/profile', {
      json: {
        name: state.config.name,
        location: state.config.location,
        jobTitle: state.config.jobTitle,
        pronouns: state.config.pronouns,
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
    $q.notify({
      type: 'positive',
      message: t('profile.saveSuccess')
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('profile.saveFailed'),
      caption: err.message
    })
  }
  $q.loading.hide()
}

// MOUNTED

onMounted(() => {
  fetchProfile()
})
</script>
