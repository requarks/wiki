<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-cloud-storage.svg', alt='Storage', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:storage.title')}}
            .subheading.grey--text.animated.fadeInLeft.wait-p4s {{$t('admin:storage.subtitle')}}
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subheading {{$t('admin:storage.targets')}}
          v-list(two-line, dense).py-0
            template(v-for='(tgt, idx) in targets')
              v-list-tile(:key='tgt.key', @click='selectedTarget = tgt.key', :disabled='!tgt.isAvailable')
                v-list-tile-avatar
                  v-icon(color='grey', v-if='!tgt.isAvailable') indeterminate_check_box
                  v-icon(color='primary', v-else-if='tgt.isEnabled', v-ripple, @click='tgt.key !== `local` && (tgt.isEnabled = false)') check_box
                  v-icon(color='grey', v-else, v-ripple, @click='tgt.isEnabled = true') check_box_outline_blank
                v-list-tile-content
                  v-list-tile-title.body-2(:class='!tgt.isAvailable ? `grey--text` : (selectedTarget === tgt.key ? `primary--text` : ``)') {{ tgt.title }}
                  v-list-tile-sub-title.caption(:class='!tgt.isAvailable ? `grey--text text--lighten-1` : (selectedTarget === tgt.key ? `blue--text ` : ``)') {{ tgt.description }}
                v-list-tile-avatar(v-if='selectedTarget === tgt.key')
                  v-icon.animated.fadeInLeft(color='primary') arrow_forward_ios
              v-divider(v-if='idx < targets.length - 1')

        v-card.mt-3.animated.fadeInUp.wait-p2s
          v-toolbar(flat, :color='$vuetify.dark ? `grey darken-3-l5` : `grey darken-3`', dark, dense)
            .subheading {{$t('admin:storage.status')}}
            v-spacer
            looping-rhombuses-spinner(
              :animation-duration='5000'
              :rhombus-size='10'
              color='#FFF'
            )
          v-list.py-0(two-line, dense)
            template(v-for='(tgt, n) in status')
              v-list-tile(:key='tgt.key')
                template(v-if='tgt.status === `pending`')
                  v-list-tile-avatar(color='purple')
                    v-icon(color='white') schedule
                  v-list-tile-content
                    v-list-tile-title.body-2 {{tgt.title}}
                    v-list-tile-sub-title.purple--text.caption {{tgt.status}}
                  v-list-tile-action
                    v-progress-circular(indeterminate, :size='20', :width='2', color='purple')
                template(v-else-if='tgt.status === `operational`')
                  v-list-tile-avatar(color='green')
                    v-icon(color='white') check_circle
                  v-list-tile-content
                    v-list-tile-title.body-2 {{tgt.title}}
                    v-list-tile-sub-title.green--text.caption {{$t('admin:storage.lastSync', { time: $options.filters.moment(tgt.lastAttempt, 'from') })}}
                template(v-else)
                  v-list-tile-avatar(color='red')
                    v-icon(color='white') highlight_off
                  v-list-tile-content
                    v-list-tile-title.body-2 {{tgt.title}}
                    v-list-tile-sub-title.red--text.caption {{$t('admin:storage.lastSyncAttempt', { time: $options.filters.moment(tgt.lastAttempt, 'from') })}}
                  v-list-tile-action
                    v-menu
                      v-btn(slot='activator', icon)
                        v-icon(color='red') info
                      v-card(width='450')
                        v-toolbar(flat, color='red', dark, dense) {{$t('admin:storage.errorMsg')}}
                        v-card-text {{tgt.message}}

              v-divider(v-if='n < status.length - 1')
            v-list-tile(v-if='status.length < 1')
              em {{$t('admin:storage.noTarget')}}

      v-flex(xs12, lg9)
        v-card.wiki-form.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, flat, dark)
            .subheading {{target.title}}
          v-card-text
            v-form
              .targetlogo
                img(:src='target.logo', :alt='target.title')
              v-subheader.pl-0 {{target.title}}
              .caption {{target.description}}
              .caption: a(:href='target.website') {{target.website}}
              v-divider.mt-3
              v-subheader.pl-0 {{$t('admin:storage.targetConfig')}}
              .body-1.ml-3(v-if='!target.config || target.config.length < 1') {{$t('admin:storage.noConfigOption')}}
              template(v-else, v-for='cfg in target.config')
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
                v-textarea(
                  v-else-if='cfg.value.type === "string" && cfg.value.multiline'
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
              v-subheader.pl-0 {{$t('admin:storage.syncDirection')}}
              .body-1.ml-3 {{$t('admin:storage.syncDirectionSubtitle')}}
              .pr-3.pt-3
                v-radio-group.ml-3.py-0(v-model='target.mode')
                  v-radio(
                    :label='$t(`admin:storage.syncDirBi`)'
                    color='primary'
                    value='sync'
                    :disabled='target.supportedModes.indexOf(`sync`) < 0'
                  )
                  v-radio(
                    :label='$t(`admin:storage.syncDirPush`)'
                    color='primary'
                    value='push'
                    :disabled='target.supportedModes.indexOf(`push`) < 0'
                  )
                  v-radio(
                    :label='$t(`admin:storage.syncDirPull`)'
                    color='primary'
                    value='pull'
                    :disabled='target.supportedModes.indexOf(`pull`) < 0'
                  )
              .body-1.ml-3
                strong {{$t('admin:storage.syncDirBi')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`sync`) < 0') {{$t('admin:storage.unsupported')}}]
                .pb-3 {{$t('admin:storage.syncDirBiHint')}}
                strong {{$t('admin:storage.syncDirPush')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`push`) < 0') {{$t('admin:storage.unsupported')}}]
                .pb-3 {{$t('admin:storage.syncDirPushHint')}}
                strong {{$t('admin:storage.syncDirPull')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`pull`) < 0') {{$t('admin:storage.unsupported')}}]
                .pb-3 {{$t('admin:storage.syncDirPullHint')}}

              template(v-if='target.hasSchedule')
                v-divider.mt-3
                v-subheader.pl-0 {{$t('admin:storage.syncSchedule')}}
                .body-1.ml-3 {{$t('admin:storage.syncScheduleHint')}}
                .pa-3
                  duration-picker(v-model='target.syncInterval')
                  i18next.caption.mt-3(path='admin:storage.syncScheduleCurrent', tag='div')
                    strong(place='schedule') {{getDefaultSchedule(target.syncInterval)}}
                  i18next.caption(path='admin:storage.syncScheduleDefault', tag='div')
                    strong(place='schedule') {{getDefaultSchedule(target.syncIntervalDefault)}}

              template(v-if='target.actions && target.actions.length > 0')
                v-divider.mt-3
                v-subheader.pl-0 {{$t('admin:storage.actions')}}
                v-container.pt-0(grid-list-xl, fluid)
                  v-layout(row, wrap, fill-height)
                    v-flex(xs12, lg6, xl4, v-for='act of target.actions', :key='act.handler')
                      v-card.radius-7.grey(flat, :class='$vuetify.dark ? `darken-3-d5` : `lighten-3`', height='100%')
                        v-card-text
                          .subheading(v-html='act.label')
                          .body-1.mt-2(v-html='act.hint')
                          v-btn.mx-0.mt-3(
                            @click='executeAction(target.key, act.handler)'
                            outline
                            :color='$vuetify.dark ? `blue` : `primary`'
                            :disabled='runningAction'
                            :loading='runningActionHandler === act.handler'
                            ) {{$t('admin:storage.actionRun')}}

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
      selectedTarget: '',
      target: {
        supportedModes: []
      },
      targets: [],
      status: []
    }
  },
  computed: {
    activeTargets() {
      return _.filter(this.targets, 'isEnabled')
    }
  },
  watch: {
    selectedTarget(newValue, oldValue) {
      this.target = _.find(this.targets, ['key', newValue]) || {}
    },
    targets(newValue, oldValue) {
      this.selectedTarget = _.get(_.find(this.targets, ['isEnabled', true]), 'key', 'disk')
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
      this.$store.commit('showNotification', {
        message: 'Storage configuration saved successfully.',
        style: 'success',
        icon: 'check'
      })
      this.$store.commit(`loadingStop`, 'admin-storage-savetargets')
    },
    getDefaultSchedule(val) {
      if (!val) { return 'N/A' }
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
