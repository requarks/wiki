<template lang="pug">
q-menu.translucent-menu(
  anchor='bottom right'
  self='top right'
  :offset='[0, 10]'
  ref='menuRef'
  )
  q-card(style='width: 850px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-choose.svg', left, size='sm')
      span {{t(`admin.users.defaults`)}}
    q-list(padding)
      q-item
        blueprint-icon(icon='timezone')
        q-item-section
          q-item-label {{t(`admin.general.defaultTimezone`)}}
          q-item-label(caption) {{t(`admin.general.defaultTimezoneHint`)}}
        q-item-section
          q-select(
            outlined
            v-model='state.timezone'
            :options='timezones'
            option-value='value'
            option-label='text'
            emit-value
            map-options
            dense
            options-dense
            :virtual-scroll-slice-size='1000'
            :aria-label='t(`admin.general.defaultTimezone`)'
            )
      q-separator.q-my-sm(inset)
      q-item
        blueprint-icon(icon='calendar')
        q-item-section
          q-item-label {{t(`admin.general.defaultDateFormat`)}}
          q-item-label(caption) {{t(`admin.general.defaultDateFormatHint`)}}
        q-item-section
          q-select(
            outlined
            v-model='state.dateFormat'
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
          q-item-label {{t(`admin.general.defaultTimeFormat`)}}
          q-item-label(caption) {{t(`admin.general.defaultTimeFormatHint`)}}
        q-item-section.col-auto
          q-btn-toggle(
            v-model='state.timeFormat'
            push
            glossy
            no-caps
            toggle-color='primary'
            :options='timeFormats'
          )
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        v-close-popup
        )
      q-btn(
        unelevated
        :label='t(`common.actions.save`)'
        color='primary'
        padding='xs md'
        @click='save'
        )
    q-inner-loading(:showing='state.loading > 0')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { onMounted, reactive, ref } from 'vue'
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  timezone: '',
  dateFormat: '',
  timeFormat: ''
})

const menuRef = ref(null)

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
const timezones = Intl.supportedValuesOf('timeZone')

// METHODS

async function save () {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveSite (
          $timezone: String!
          $dateFormat: String!
          $timeFormat: String!
        ) {
          updateUserDefaults (
            timezone: $timezone
            dateFormat: $dateFormat
            timeFormat: $timeFormat
          ) {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `,
      variables: {
        timezone: state.timezone,
        dateFormat: state.dateFormat,
        timeFormat: state.timeFormat
      }
    })
    if (resp?.data?.updateUserDefaults?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.users.defaultsSaveSuccess')
      })
      menuRef.value.hide()
    } else {
      throw new Error(resp?.data?.updateUserDefaults?.operation?.message)
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save user defaults.',
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(async () => {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getUserDefaults {
          userDefaults {
            timezone
            dateFormat
            timeFormat
          }
        }
      `,
      fetchPolicy: 'network-only'
    })
    const respData = cloneDeep(resp?.data?.userDefaults)
    state.timezone = respData.timezone
    state.dateFormat = respData.dateFormat
    state.timeFormat = respData.timeFormat
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to load user defaults',
      caption: err.message
    })
  }
  state.loading--
})

</script>
