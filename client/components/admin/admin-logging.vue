<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-registry-editor.svg', alt='Logging', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Logging
            .subtitle-1.grey--text Configure the system logger(s) #[v-chip(label, color='primary', small).white--text coming soon]
          v-spacer
          v-btn(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn(color='black', disabled, depressed, @click='toggleConsole', large)
            v-icon check
            span Live Trail
          v-btn(color='success', @click='save', depressed, large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}

        v-card.mt-3
          v-tabs(color='grey darken-2', fixed-tabs, slider-color='white', show-arrows, dark)
            v-tab(key='settings'): v-icon settings
            v-tab(v-for='logger in activeLoggers', :key='logger.key') {{ logger.title }}

            v-tab-item(key='settings', :transition='false', :reverse-transition='false')
              v-card.pa-3(flat, tile)
                .body-2.grey--text.text--darken-1 Select which logging service to enable:
                .caption.grey--text.pb-2 Some loggers require additional configuration in their dedicated tab (when selected).
                v-form
                  v-checkbox.my-0(
                    v-for='(logger, n) in loggers'
                    v-model='logger.isEnabled'
                    :key='logger.key'
                    :label='logger.title'
                    color='primary'
                    hide-details
                    disabled
                  )

            v-tab-item(v-for='(logger, n) in activeLoggers', :key='logger.key', :transition='false', :reverse-transition='false')
              v-card.wiki-form.pa-3(flat, tile)
                v-form
                  .loggerlogo
                    img(:src='logger.logo', :alt='logger.title')
                  v-subheader.pl-0 {{logger.title}}
                  .caption {{logger.description}}
                  .caption: a(:href='logger.website') {{logger.website}}
                  v-divider.mt-3
                  v-subheader.pl-0 Logger Configuration
                  .body-1.ml-3(v-if='!logger.config || logger.config.length < 1') This logger has no configuration options you can modify.
                  template(v-else, v-for='cfg in logger.config')
                    v-select(
                      v-if='cfg.value.type === "string" && cfg.value.enum'
                      outline
                      background-color='grey lighten-2'
                      :items='cfg.value.enum'
                      :key='cfg.key'
                      :label='cfg.value.title'
                      v-model='cfg.value.value'
                      prepend-icon='settings_applications'
                      :hint='cfg.value.hint ? cfg.value.hint : ""'
                      persistent-hint
                      :class='cfg.value.hint ? "mb-2" : ""'
                    )
                    v-switch(
                      v-else-if='cfg.value.type === "boolean"'
                      :key='cfg.key'
                      :label='cfg.value.title'
                      v-model='cfg.value.value'
                      color='primary'
                      prepend-icon='settings_applications'
                      :hint='cfg.value.hint ? cfg.value.hint : ""'
                      persistent-hint
                      )
                    v-text-field(
                      v-else
                      outline
                      background-color='grey lighten-2'
                      :key='cfg.key'
                      :label='cfg.value.title'
                      v-model='cfg.value.value'
                      prepend-icon='settings_applications'
                      :hint='cfg.value.hint ? cfg.value.hint : ""'
                      persistent-hint
                      :class='cfg.value.hint ? "mb-2" : ""'
                      )
                  v-divider.mt-3
                  v-subheader.pl-0 Log Level
                  .body-1.ml-3 Select the minimum error level that will be reported to this logger.
                  v-layout(row)
                    v-flex(xs12, md6, lg4)
                      .pt-3
                        v-select(
                          single-line
                          outline
                          background-color='grey lighten-2'
                          :items='levels'
                          label='Level'
                          v-model='logger.level'
                          prepend-icon='graphic_eq'
                          hint='Default: warn'
                          persistent-hint
                        )

    logging-console(v-model='showConsole')
</template>

<script>
import _ from 'lodash'

import LoggingConsole from './admin-logging-console.vue'

import loggersQuery from 'gql/admin/logging/logging-query-loggers.gql'
import loggersSaveMutation from 'gql/admin/logging/logging-mutation-save-loggers.gql'

export default {
  components: {
    LoggingConsole
  },
  data() {
    return {
      showConsole: false,
      loggers: [],
      levels: ['error', 'warn', 'info', 'debug', 'verbose']
    }
  },
  computed: {
    activeLoggers() {
      return _.filter(this.loggers, 'isEnabled')
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.loggers.refetch()
      this.$store.commit('showNotification', {
        message: 'List of loggers has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    async save() {
      this.$store.commit(`loadingStart`, 'admin-logging-saveloggers')
      await this.$apollo.mutate({
        mutation: loggersSaveMutation,
        variables: {
          loggers: this.loggers.map(tgt => _.pick(tgt, [
            'isEnabled',
            'key',
            'config',
            'level'
          ])).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.stringify({ v: cfg.value.value })}))}))
        }
      })
      this.$store.commit('showNotification', {
        message: 'Logging configuration saved successfully.',
        style: 'success',
        icon: 'check'
      })
      this.$store.commit(`loadingStop`, 'admin-logging-saveloggers')
    },
    toggleConsole() {
      this.showConsole = !this.showConsole
    }
  },
  apollo: {
    loggers: {
      query: loggersQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.logging.loggers).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.parse(cfg.value)}))})),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-logging-refresh')
      }
    }
  }
}
</script>

<style lang='scss' scoped>

.loggerlogo {
  width: 250px;
  height: 85px;
  float:right;
  display: flex;
  justify-content: flex-end;
  align-items: center;

  img {
    max-width: 100%;
    max-height: 50px;
  }
}

</style>
