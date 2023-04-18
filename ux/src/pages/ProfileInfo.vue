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
      )
  .actions-bar.q-mt-lg
    q-btn(
      icon='las la-check'
      unelevated
      :label='t(`common.actions.saveChanges`)'
      color='secondary'
      @click='save'
    )
</template>

<script setup>
import gql from 'graphql-tag'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive } from 'vue'

import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

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
  }
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

async function save () {
  $q.loading.show({
    message: t('profile.saving')
  })
  try {
    const respRaw = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveProfile (
          $name: String
          $location: String
          $jobTitle: String
          $pronouns: String
          $timezone: String
          $dateFormat: String
          $timeFormat: String
          $appearance: UserSiteAppearance
          $cvd: UserCvdChoices
        ) {
          updateProfile (
            name: $name
            location: $location
            jobTitle: $jobTitle
            pronouns: $pronouns
            timezone: $timezone
            dateFormat: $dateFormat
            timeFormat: $timeFormat
            appearance: $appearance
            cvd: $cvd
          ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: state.config
    })
    if (respRaw.data?.updateProfile?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('profile.saveSuccess')
      })
      userStore.$patch(state.config)
    } else {
      throw new Error(respRaw.data?.updateProfile?.operation?.message || 'An unexpected error occured')
    }
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
  state.config.name = userStore.name || ''
  state.config.email = userStore.email
  state.config.location = userStore.location || ''
  state.config.jobTitle = userStore.jobTitle || ''
  state.config.pronouns = userStore.pronouns || ''
  state.config.timezone = userStore.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  state.config.dateFormat = userStore.dateFormat || ''
  state.config.timeFormat = userStore.timeFormat || '12h'
  state.config.appearance = userStore.appearance || 'site'
  state.config.cvd = userStore.cvd || 'none'
})
</script>
