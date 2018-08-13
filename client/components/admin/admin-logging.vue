<template lang='pug'>
  v-card(flat)
    v-card(flat, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"').pa-3.pt-4
      .headline.primary--text Logging
      .subheading.grey--text Configure the system logger(s)
    v-tabs(:color='$vuetify.dark ? "primary" : "grey lighten-4"', fixed-tabs, :slider-color='$vuetify.dark ? "white" : "primary"', show-arrows)
      v-tab(key='settings'): v-icon settings
      v-tab(v-for='svc in activeServices', :key='svc.key') {{ svc.title }}

      v-tab-item(key='settings', :transition='false', :reverse-transition='false')
        v-card.pa-3
          .body-2.pb-2 Select which logging service to enable:
          v-form
            v-checkbox(
              v-for='(svc, n) in services',
              v-model='selectedServices',
              :key='svc.key',
              :label='svc.title',
              :value='svc.key',
              color='primary',
              :disabled='svc.key === `console`'
              hide-details
            )
            v-divider
            v-btn(color='primary')
              v-icon(left) chevron_right
              | Set Services
            v-btn(color='black', dark, @click='toggleConsole')
              v-icon(left) keyboard
              | View Console
            v-btn(color='black', dark)
              v-icon(left) layers_clear
              | Purge Logs
            v-btn(icon, @click='refresh')
              v-icon.grey--text refresh

      v-tab-item(v-for='(svc, n) in activeServices', :key='svc.key', :transition='false', :reverse-transition='false')
        v-card.pa-3
          v-form
            v-subheader Service Configuration
            .body-1(v-if='!svc.props || svc.props.length < 1') This logging service has no configuration options you can modify.
            v-text-field(v-else, v-for='prop in svc.props', :key='prop', :label='prop', prepend-icon='mode_edit')
            v-divider
            v-btn(color='primary')
              v-icon(left) chevron_right
              | Save Configuration

    logging-console(v-model='showConsole')
</template>

<script>
import _ from 'lodash'

import LoggingConsole from './admin-logging-console.vue'

export default {
  components: {
    LoggingConsole
  },
  data() {
    return {
      showConsole: false,
      services: [],
      selectedServices: ['console'],
      refreshCompleted: false
    }
  },
  computed: {
    activeServices() {
      return _.filter(this.services, 'isEnabled')
    }
  },
  // apollo: {
  //   services: {
  //     query: CONSTANTS.GRAPH.AUTHENTICATION.QUERY_PROVIDERS,
  //     update: (data) => data.authentication.providers
  //   }
  // },
  methods: {
    async refresh() {
      await this.$apollo.queries.services.refetch()
      this.refreshCompleted = true
    },
    toggleConsole () {
      this.showConsole = !this.showConsole
    }
  }
}
</script>

<style lang='scss'>

</style>
