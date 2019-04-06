<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-cloud-storage.svg', alt='Storage', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Storage
            .subheading.grey--text Set backup and sync targets for your content
          v-spacer
          v-btn(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn(color='success', @click='save', depressed, large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}

        v-card.mt-3
          v-tabs(color='grey darken-2', fixed-tabs, slider-color='white', show-arrows, dark, v-model='currentTab')
            v-tab(key='settings'): v-icon settings
            v-tab(v-for='tgt in activeTargets', :key='tgt.key') {{ tgt.title }}

            v-tab-item(key='settings', :transition='false', :reverse-transition='false')
              v-container.pa-3(fluid, grid-list-md)
                v-layout(row, wrap)
                  v-flex(xs12, md6)
                    .body-2.grey--text.text--darken-1 Select which storage targets to enable:
                    .caption.grey--text.pb-2 Some storage targets require additional configuration in their dedicated tab (when selected).
                    v-form
                      v-checkbox.my-0(
                        :disabled='!tgt.isAvailable'
                        v-for='tgt in targets'
                        v-model='tgt.isEnabled'
                        :key='tgt.key'
                        :label='tgt.title'
                        color='primary'
                        hide-details
                      )
                  v-flex(xs12, md6)
                    .pa-3.grey.radius-7(:class='$vuetify.dark ? "darken-4" : "lighten-5"')
                      v-layout.pa-2(row, justify-space-between)
                        .body-2.grey--text.text--darken-1 Status
                        .d-flex
                          looping-rhombuses-spinner.mt-1(
                            :animation-duration='5000'
                            :rhombus-size='10'
                            color='#BBB'
                          )
                          .caption.ml-3.grey--text This panel refreshes automatically.
                      v-divider
                      v-toolbar.mt-2.radius-7(
                        v-for='(tgt, n) in status'
                        :key='tgt.key'
                        dense
                        :color='getStatusColor(tgt.status)'
                        dark
                        flat
                        :extended='tgt.status !== `pending`',
                        :extension-height='tgt.status === `error` ? 100 : 70'
                        )
                        .pa-3.red.darken-2.radius-7(v-if='tgt.status === `error`', slot='extension') {{tgt.message}}
                        v-toolbar.radius-7(
                          color='green darken-2'
                          v-else-if='tgt.status !== `pending`'
                          slot='extension'
                          flat
                          dense
                          )
                          span Last synchronization {{tgt.lastAttempt | moment('from') }}
                        .body-2 {{tgt.title}}
                        v-spacer
                        .body-1 {{tgt.status}}
                      v-alert.mt-3.radius-7(v-if='status.length < 1', outline, :value='true', color='indigo') You don't have any active storage target.

            v-tab-item(v-for='(tgt, n) in activeTargets', :key='tgt.key', :transition='false', :reverse-transition='false')
              v-card.wiki-form.pa-3(flat, tile)
                v-form
                  .targetlogo
                    img(:src='tgt.logo', :alt='tgt.title')
                  v-subheader.pl-0 {{tgt.title}}
                  .caption {{tgt.description}}
                  .caption: a(:href='tgt.website') {{tgt.website}}
                  v-divider.mt-3
                  v-subheader.pl-0 Target Configuration
                  .body-1.ml-3(v-if='!tgt.config || tgt.config.length < 1') This storage target has no configuration options you can modify.
                  template(v-else, v-for='cfg in tgt.config')
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
                    v-switch.mb-3(
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
                  v-subheader.pl-0 Sync Direction
                  .body-1.ml-3 Choose how content synchronization is handled for this storage target.
                  .pr-3.pt-3
                    v-radio-group.ml-3.py-0(v-model='tgt.mode')
                      v-radio(
                        label='Bi-directional'
                        color='primary'
                        value='sync'
                        :disabled='tgt.supportedModes.indexOf(`sync`) < 0'
                      )
                      v-radio(
                        label='Push to target'
                        color='primary'
                        value='push'
                        :disabled='tgt.supportedModes.indexOf(`push`) < 0'
                      )
                      v-radio(
                        label='Pull from target'
                        color='primary'
                        value='pull'
                        :disabled='tgt.supportedModes.indexOf(`pull`) < 0'
                      )
                  .body-1.ml-3
                    strong Bi-directional #[em.red--text.text--lighten-2(v-if='tgt.supportedModes.indexOf(`sync`) < 0') Unsupported]
                    .pb-3 In bi-directional mode, content is first pulled from the storage target. Any newer content overwrites local content. New content since last sync is then pushed to the storage target, overwriting any content on target if present.
                    strong Push to target #[em.red--text.text--lighten-2(v-if='tgt.supportedModes.indexOf(`push`) < 0') Unsupported]
                    .pb-3 Content is always pushed to the storage target, overwriting any existing content. This is safest choice for backup scenarios.
                    strong Pull from target #[em.red--text.text--lighten-2(v-if='tgt.supportedModes.indexOf(`pull`) < 0') Unsupported]
                    .pb-3 Content is always pulled from the storage target, overwriting any local content which already exists. This choice is usually reserved for single-use content import. Caution with this option as any local content will always be overwritten!

                  template(v-if='tgt.hasSchedule')
                    v-divider.mt-3
                    v-subheader.pl-0 Sync Schedule
                    .body-1.ml-3 For performance reasons, this storage target synchronize changes on an interval-based schedule, instead of on every change. Define at which interval should the synchronization occur.
                    .pa-3
                      duration-picker(v-model='tgt.syncInterval')
                      .caption.mt-3 Currently set to every #[strong {{getDefaultSchedule(tgt.syncInterval)}}].
                      .caption The default is every #[strong {{getDefaultSchedule(tgt.syncIntervalDefault)}}].

                  template(v-if='tgt.actions && tgt.actions.length > 0')
                    v-divider.mt-3
                    v-subheader.pl-0 Actions
                    v-container.pt-0(grid-list-xl, fluid)
                      v-layout(row, wrap, fill-height)
                        v-flex(xs12, lg6, xl4, v-for='act of tgt.actions')
                          v-card.radius-7.grey(flat, :class='$vuetify.dark ? `darken-3-d5` : `lighten-3`', height='100%')
                            v-card-text
                              .subheading(v-html='act.label')
                              .body-1.mt-2(v-html='act.hint')
                              v-btn.mx-0.mt-3(
                                @click='executeAction(tgt.key, act.handler)'
                                outline
                                :color='$vuetify.dark ? `blue` : `primary`'
                                :disabled='runningAction'
                                :loading='runningActionHandler === act.handler'
                                ) Run

</template>

<script>
import _ from 'lodash'
import moment from 'moment'
import momentDurationFormatSetup from 'moment-duration-format'

import DurationPicker from '../common/duration-picker.vue'
import { LoopingRhombusesSpinner } from 'epic-spinners'

import statusQuery from 'gql/admin/storage/storage-query-status.gql'
import targetsQuery from 'gql/admin/storage/storage-query-targets.gql'
import targetExecuteActionMutation from 'gql/admin/storage/storage-mutation-executeaction.gql'
import targetsSaveMutation from 'gql/admin/storage/storage-mutation-save-targets.gql'

momentDurationFormatSetup(moment)

export default {
  components: {
    DurationPicker,
    LoopingRhombusesSpinner
  },
  filters: {
    startCase(val) { return _.startCase(val) }
  },
  data() {
    return {
      runningAction: false,
      runningActionHandler: '',
      currentTab: 0,
      targets: [],
      status: []
    }
  },
  computed: {
    activeTargets() {
      return _.filter(this.targets, 'isEnabled')
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.targets.refetch()
      this.$store.commit('showNotification', {
        message: 'List of storage targets has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    async save() {
      this.$store.commit(`loadingStart`, 'admin-storage-savetargets')
      await this.$apollo.mutate({
        mutation: targetsSaveMutation,
        variables: {
          targets: this.targets.map(tgt => _.pick(tgt, [
            'isEnabled',
            'key',
            'config',
            'mode',
            'syncInterval'
          ])).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.stringify({ v: cfg.value.value })}))}))
        }
      })
      this.currentTab = 0
      this.$store.commit('showNotification', {
        message: 'Storage configuration saved successfully.',
        style: 'success',
        icon: 'check'
      })
      this.$store.commit(`loadingStop`, 'admin-storage-savetargets')
    },
    getStatusColor(state) {
      switch (state) {
        case 'pending':
          return 'purple lighten-2'
        case 'operational':
          return 'green'
        case 'error':
          return 'red'
        default:
          return 'grey darken-2'
      }
    },
    getDefaultSchedule(val) {
      return moment.duration(val).format('y [years], M [months], d [days], h [hours], m [minutes]')
    },
    async executeAction(targetKey, handler) {
      this.$store.commit(`loadingStart`, 'admin-storage-executeaction')
      this.runningAction = true
      this.runningActionHandler = handler
      try {
        await this.$apollo.mutate({
          mutation: targetExecuteActionMutation,
          variables: {
            targetKey,
            handler
          }
        })
        this.$store.commit('showNotification', {
          message: 'Action completed.',
          style: 'success',
          icon: 'check'
        })
      } catch (err) {
        console.warn(err)
      }
      this.runningAction = false
      this.runningActionHandler = ''
      this.$store.commit(`loadingStop`, 'admin-storage-executeaction')
    }
  },
  apollo: {
    targets: {
      query: targetsQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.storage.targets).map(str => ({
        ...str,
        config: _.sortBy(str.config.map(cfg => ({
          ...cfg,
          value: JSON.parse(cfg.value)
        })), [t => t.value.order])
      })),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-storage-targets-refresh')
      }
    },
    status: {
      query: statusQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.storage.status,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-storage-status-refresh')
      },
      pollInterval: 3000
    }
  }
}
</script>

<style lang='scss' scoped>

.targetlogo {
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
