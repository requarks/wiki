<template lang='pug'>
  v-toolbar.radius-7(flat, :color='$vuetify.theme.dark ? "grey darken-4-l3" : "grey lighten-3"')
    .body-2.mr-3 {{$t('common:duration.every')}}
    v-text-field(
      solo
      hide-details
      flat
      reverse
      v-model='minutes'
      style='flex: 1 1 70px;'
    )
    .body-2.mx-3 {{$t('common:duration.minutes')}}
    v-divider.mr-3
    v-text-field(
      solo
      hide-details
      flat
      reverse
      v-model='hours'
      style='flex: 1 1 70px;'
    )
    .body-2.mx-3 {{$t('common:duration.hours')}}
    v-divider.mr-3
    v-text-field(
      solo
      hide-details
      flat
      reverse
      v-model='days'
      style='flex: 1 1 70px;'
    )
    .body-2.mx-3 {{$t('common:duration.days')}}
    v-divider.mr-3
    v-text-field(
      solo
      hide-details
      flat
      reverse
      v-model='months'
      style='flex: 1 1 70px;'
    )
    .body-2.mx-3 {{$t('common:duration.months')}}
    v-divider.mr-3
    v-text-field(
      solo
      hide-details
      flat
      reverse
      v-model='years'
      style='flex: 1 1 70px;'
    )
    .body-2.mx-3 {{$t('common:duration.years')}}
</template>

<script>
import _ from 'lodash'
import moment from 'moment'

export default {
  props: {
    value: {
      type: String,
      default: 'PT5M'
    }
  },
  data() {
    return {
      duration: moment.duration(0)
    }
  },
  computed: {
    years: {
      get() { return this.duration.years() || 0 },
      set(val) { this.rebuild(_.toNumber(val), 'years') }
    },
    months: {
      get() { return this.duration.months() || 0 },
      set(val) { this.rebuild(_.toNumber(val), 'months') }
    },
    days: {
      get() { return this.duration.days() || 0 },
      set(val) { this.rebuild(_.toNumber(val), 'days') }
    },
    hours: {
      get() { return this.duration.hours() || 0 },
      set(val) { this.rebuild(_.toNumber(val), 'hours') }
    },
    minutes: {
      get() { return this.duration.minutes() || 0 },
      set(val) { this.rebuild(_.toNumber(val), 'minutes') }
    }
  },
  watch: {
    value(newValue, oldValue) {
      this.duration = moment.duration(newValue)
    }
  },
  methods: {
    rebuild(val, unit) {
      if (!_.isFinite(val) || val < 0) {
        val = 0
      }
      const newDuration = {
        minutes: this.duration.minutes(),
        hours: this.duration.hours(),
        days: this.duration.days(),
        months: this.duration.months(),
        years: this.duration.years()
      }
      _.set(newDuration, unit, val)
      this.duration = moment.duration(newDuration)
      this.$emit('input', this.duration.toISOString())
    }
  },
  mounted() {
    this.duration = moment.duration(this.value)
  }
}
</script>
