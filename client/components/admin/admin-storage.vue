<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-cloud-storage.svg', alt='Storage', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:storage.title')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{$t('admin:storage.subtitle')}}
          v-spacer
          v-btn.animated.fadeInDown.wait-p3s(icon, outlined, color='grey', href='https://docs.requarks.io/storage', target='_blank')
            v-icon mdi-help-circle
          v-btn.mx-3.animated.fadeInDown.wait-p2s(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subtitle-1 {{$t('admin:storage.targets')}}
          v-list(two-line, dense).py-0
            template(v-for='(tgt, idx) in targets')
              v-list-item(:key='tgt.key', @click='selectedTarget = tgt.key', :disabled='!tgt.isAvailable')
                v-list-item-avatar(size='24')
                  v-icon(color='grey', v-if='!tgt.isAvailable') mdi-minus-box-outline
                  v-icon(color='primary', v-else-if='tgt.isEnabled', v-ripple, @click='tgt.key !== `local` && (tgt.isEnabled = false)') mdi-checkbox-marked-outline
                  v-icon(color='grey', v-else, v-ripple, @click='tgt.isEnabled = true') mdi-checkbox-blank-outline
                v-list-item-content
                  v-list-item-title.body-2(:class='!tgt.isAvailable ? `grey--text` : (selectedTarget === tgt.key ? `primary--text` : ``)') {{ tgt.title }}
                  v-list-item-subtitle: .caption(:class='!tgt.isAvailable ? `grey--text text--lighten-1` : (selectedTarget === tgt.key ? `blue--text ` : ``)') {{ tgt.description }}
                v-list-item-avatar(v-if='selectedTarget === tgt.key', size='24')
                  v-icon.animated.fadeInLeft(color='primary', large) mdi-chevron-right
              v-divider(v-if='idx < targets.length - 1')

        v-card.mt-3.animated.fadeInUp.wait-p2s
          v-toolbar(flat, :color='$vuetify.theme.dark ? `grey darken-3-l5` : `grey darken-3`', dark, dense)
            .subtitle-1 {{$t('admin:storage.status')}}
            v-spacer
            looping-rhombuses-spinner(
              :animation-duration='5000'
              :rhombus-size='10'
              color='#FFF'
            )
          v-list.py-0(two-line, dense)
            template(v-for='(tgt, n) in status')
              v-list-item(:key='tgt.key')
                template(v-if='tgt.status === `pending`')
                  v-list-item-avatar(color='purple')
                    v-icon(color='white') mdi-clock-outline
                  v-list-item-content
                    v-list-item-title.body-2 {{tgt.title}}
                    v-list-item-subtitle.purple--text.caption {{tgt.status}}
                  v-list-item-action
                    v-progress-circular(indeterminate, :size='20', :width='2', color='purple')
                template(v-else-if='tgt.status === `operational`')
                  v-list-item-avatar(color='green')
                    v-icon(color='white') mdi-check-circle
                  v-list-item-content
                    v-list-item-title.body-2 {{tgt.title}}
                    v-list-item-subtitle.green--text.caption {{$t('admin:storage.lastSync', { time: $options.filters.moment(tgt.lastAttempt, 'from') })}}
                template(v-else)
                  v-list-item-avatar(color='red')
                    v-icon(color='white') mdi-close-circle-outline
                  v-list-item-content
                    v-list-item-title.body-2 {{tgt.title}}
                    v-list-item-subtitle.red--text.caption {{$t('admin:storage.lastSyncAttempt', { time: $options.filters.moment(tgt.lastAttempt, 'from') })}}
                  v-list-item-action
                    v-menu
                      template(v-slot:activator='{ on }')
                        v-btn(icon, v-on='on')
                          v-icon(color='red') mdi-information
                      v-card(width='450')
                        v-toolbar(flat, color='red', dark, dense) {{$t('admin:storage.errorMsg')}}
                        v-card-text {{tgt.message}}

              v-divider(v-if='n < status.length - 1')
            v-list-item(v-if='status.length < 1')
              em {{$t('admin:storage.noTarget')}}

      v-flex(xs12, lg9)
        v-card.wiki-form.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, flat, dark)
            .subtitle-1 {{target.title}}
            v-spacer
            v-switch(
              dark
              color='blue lighten-5'
              label='Active'
              v-model='target.isEnabled'
              hide-details
              inset
              )
          v-card-info(color='blue')
            div
              div {{target.description}}
              span.caption: a(:href='target.website') {{target.website}}
            v-spacer
            .admin-providerlogo
              img(:src='target.logo', :alt='target.title')
          v-card-text
            v-form
              i18next.body-2(path='admin:storage.targetState', tag='div', v-if='target.isEnabled')
                v-chip(color='green', small, dark, label, place='state') {{$t('admin:storage.targetStateActive')}}
              i18next.body-2(path='admin:storage.targetState', tag='div', v-else)
                v-chip(color='red', small, dark, label, place='state') {{$t('admin:storage.targetStateInactive')}}
              v-divider.mt-3
              .overline.my-5 {{$t('admin:storage.targetConfig')}}
              .body-2.ml-3(v-if='!target.config || target.config.length < 1'): em {{$t('admin:storage.noConfigOption')}}
              template(v-else, v-for='cfg in target.config')
                v-select(
                  v-if='cfg.value.type === "string" && cfg.value.enum'
                  outlined
                  :items='cfg.value.enum'
                  :key='cfg.key'
                  :label='cfg.value.title'
                  v-model='cfg.value.value'
                  prepend-icon='mdi-cog-box'
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
                  prepend-icon='mdi-cog-box'
                  :hint='cfg.value.hint ? cfg.value.hint : ""'
                  persistent-hint
                  inset
                  )
                v-textarea(
                  v-else-if='cfg.value.type === "string" && cfg.value.multiline'
                  outlined
                  :key='cfg.key'
                  :label='cfg.value.title'
                  v-model='cfg.value.value'
                  prepend-icon='mdi-cog-box'
                  :hint='cfg.value.hint ? cfg.value.hint : ""'
                  persistent-hint
                  :class='cfg.value.hint ? "mb-2" : ""'
                  )
                v-text-field(
                  v-else
                  outlined
                  :key='cfg.key'
                  :label='cfg.value.title'
                  v-model='cfg.value.value'
                  prepend-icon='mdi-cog-box'
                  :hint='cfg.value.hint ? cfg.value.hint : ""'
                  persistent-hint
                  :class='cfg.value.hint ? "mb-2" : ""'
                  )
              v-divider.mt-3
              .overline.my-5 {{$t('admin:storage.syncDirection')}}
              .body-2.ml-3 {{$t('admin:storage.syncDirectionSubtitle')}}
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
              .body-2.ml-3
                strong {{$t('admin:storage.syncDirBi')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`sync`) < 0') {{$t('admin:storage.unsupported')}}]
                .pb-3 {{$t('admin:storage.syncDirBiHint')}}
                strong {{$t('admin:storage.syncDirPush')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`push`) < 0') {{$t('admin:storage.unsupported')}}]
                .pb-3 {{$t('admin:storage.syncDirPushHint')}}
                strong {{$t('admin:storage.syncDirPull')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`pull`) < 0') {{$t('admin:storage.unsupported')}}]
                .pb-3 {{$t('admin:storage.syncDirPullHint')}}

              template(v-if='target.hasSchedule')
                v-divider.mt-3
                .overline.my-5 {{$t('admin:storage.syncSchedule')}}
                .body-2.ml-3 {{$t('admin:storage.syncScheduleHint')}}
                .pa-3
                  duration-picker(v-model='target.syncInterval')
                  i18next.caption.mt-3(path='admin:storage.syncScheduleCurrent', tag='div')
                    strong(place='schedule') {{getDefaultSchedule(target.syncInterval)}}
                  i18next.caption(path='admin:storage.syncScheduleDefault', tag='div')
                    strong(place='schedule') {{getDefaultSchedule(target.syncIntervalDefault)}}

              template(v-if='target.actions && target.actions.length > 0')
                v-divider.mt-3
                .overline.my-5 {{$t('admin:storage.actions')}}
                v-alert(outlined, :value='!target.isEnabled', color='red', icon='mdi-alert')
                  .body-2 {{$t('admin:storage.actionsInactiveWarn')}}
                v-container.pt-0(grid-list-xl, fluid)
                  v-layout(row, wrap, fill-height)
                    v-flex(xs12, lg6, xl4, v-for='act of target.actions', :key='act.handler')
                      v-card.radius-7.grey(flat, :class='$vuetify.theme.dark ? `darken-3-d5` : `lighten-3`', height='100%')
                        v-card-text
                          .subtitle-1(v-html='act.label')
                          .body-2.mt-4(v-html='act.hint')
                          v-btn.mx-0.mt-5(
                            @click='executeAction(target.key, act.handler)'
                            outlined
                            :color='$vuetify.theme.dark ? `blue` : `primary`'
                            :disabled='runningAction || !target.isEnabled'
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
