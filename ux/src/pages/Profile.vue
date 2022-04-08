<template lang="pug">
q-page.q-py-md(:style-fn='pageStyle')
  .text-header {{$t('profile.myInfo')}}
  q-item
    blueprint-icon(icon='contact')
    q-item-section
      q-item-label {{$t(`profile.displayName`)}}
      q-item-label(caption) {{$t(`profile.displayNameHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='config.name'
        dense
        hide-bottom-space
        :aria-label='$t(`profile.displayName`)'
        )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='envelope')
    q-item-section
      q-item-label {{$t(`profile.email`)}}
      q-item-label(caption) {{$t(`profile.emailHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='config.email'
        dense
        :aria-label='$t(`profile.email`)'
        readonly
        )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='address')
    q-item-section
      q-item-label {{$t(`profile.location`)}}
      q-item-label(caption) {{$t(`profile.locationHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='config.location'
        dense
        hide-bottom-space
        :aria-label='$t(`profile.location`)'
        )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='new-job')
    q-item-section
      q-item-label {{$t(`profile.jobTitle`)}}
      q-item-label(caption) {{$t(`profile.jobTitleHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='config.jobTitle'
        dense
        hide-bottom-space
        :aria-label='$t(`profile.jobTitle`)'
        )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='gender')
    q-item-section
      q-item-label {{$t(`profile.pronouns`)}}
      q-item-label(caption) {{$t(`profile.pronounsHint`)}}
    q-item-section
      q-input(
        outlined
        v-model='config.pronouns'
        dense
        hide-bottom-space
        :aria-label='$t(`profile.pronouns`)'
        )
  .text-header.q-mt-lg {{$t('profile.preferences')}}
  q-item
    blueprint-icon(icon='timezone')
    q-item-section
      q-item-label {{$t(`profile.timezone`)}}
      q-item-label(caption) {{$t(`profile.timezoneHint`)}}
    q-item-section
      q-select(
        outlined
        v-model='config.timezone'
        :options='timezones'
        option-value='value'
        option-label='text'
        emit-value
        map-options
        dense
        options-dense
        :aria-label='$t(`admin.general.defaultTimezone`)'
      )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='calendar')
    q-item-section
      q-item-label {{$t(`profile.dateFormat`)}}
      q-item-label(caption) {{$t(`profile.dateFormatHint`)}}
    q-item-section
      q-select(
        outlined
        v-model='config.dateFormat'
        emit-value
        map-options
        dense
        :aria-label='$t(`admin.general.defaultDateFormat`)'
        :options=`[
          { label: $t('profile.localeDefault'), value: '' },
          { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
          { label: 'DD.MM.YYYY', value: 'DD.MM.YYYY' },
          { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
          { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
          { label: 'YYYY/MM/DD', value: 'YYYY/MM/DD' }
        ]`
      )
  q-separator.q-my-sm(inset)
  q-item
    blueprint-icon(icon='clock')
    q-item-section
      q-item-label {{$t(`profile.timeFormat`)}}
      q-item-label(caption) {{$t(`profile.timeFormatHint`)}}
    q-item-section.col-auto
      q-btn-toggle(
        v-model='config.timeFormat'
        push
        glossy
        no-caps
        toggle-color='primary'
        :options=`[
          { label: $t('admin.general.defaultTimeFormat12h'), value: '12h' },
          { label: $t('admin.general.defaultTimeFormat24h'), value: '24h' }
        ]`
      )
  q-separator.q-my-sm(inset)
  q-item(tag='label', v-ripple)
    blueprint-icon(icon='light-on')
    q-item-section
      q-item-label {{$t(`profile.darkMode`)}}
      q-item-label(caption) {{$t(`profile.darkModeHint`)}}
    q-item-section(avatar)
      q-toggle(
        v-model='config.darkMode'
        color='primary'
        checked-icon='las la-check'
        unchecked-icon='las la-times'
        :aria-label='$t(`profile.darkMode`)'
      )
  .actions-bar.q-mt-lg
    q-btn(
      icon='mdi-check'
      unelevated
      label='Save Changes'
      color='secondary'
    )
</template>

<script>
import { get } from 'vuex-pathify'

export default {
  data () {
    return {
      config: {
        name: 'John Doe',
        email: 'john.doe@company.com',
        location: '',
        jobTitle: '',
        pronouns: '',
        dateFormat: '',
        timeFormat: '12h',
        darkMode: false
      }
    }
  },
  computed: {
    timezones: get('data/timezones', false)
  },
  watch: {
    'config.darkMode' (newValue) {
      this.$q.dark.set(newValue)
    }
  },
  methods: {
    pageStyle (offset, height) {
      return {
        'min-height': `${height - 100 - offset}px`
      }
    }
  }
}
</script>
