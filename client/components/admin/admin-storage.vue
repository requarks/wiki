<template lang='pug'>
  v-card(tile, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"')
    .pa-3.pt-4
      .headline.primary--text Storage
      .subheading.grey--text Set backup and sync targets for your content
    v-tabs(:color='$vuetify.dark ? "primary" : "grey lighten-4"', fixed-tabs, :slider-color='$vuetify.dark ? "white" : "primary"', show-arrows)
      v-tab(key='settings'): v-icon settings
      v-tab(v-for='tgt in activeTargets', :key='tgt.key') {{ tgt.title }}

      v-tab-item(key='settings', :transition='false', :reverse-transition='false')
        v-card.pa-3(flat, tile)
          .body-2.grey--text.text--darken-1 Select which storage targets to enable:
          .caption.grey--text.pb-2 Some storage targets require additional configuration in their dedicated tab (when selected).
          v-form
            v-checkbox(
              v-for='tgt in targets'
              v-model='tgt.isEnabled'
              :key='tgt.key'
              :label='tgt.title'
              color='primary'
              :disabled='tgt.key === `local`'
              hide-details
            )

      v-tab-item(v-for='(tgt, n) in activeTargets', :key='tgt.key', :transition='false', :reverse-transition='false')
        v-card.pa-3(flat, tile)
          v-form
            v-subheader.pl-0 Target Configuration
            .body-1.ml-3(v-if='!tgt.config || tgt.config.length < 1') This storage target has no configuration options you can modify.
            v-text-field(
              v-else
              v-for='cfg in tgt.config'
              :key='cfg.key'
              :label='cfg.key'
              v-model='cfg.value'
              prepend-icon='settings_applications'
              )
            v-divider
            v-subheader.pl-0 Sync Direction
            .body-1.ml-3 Choose how content synchronization is handled for this storage target.
            .pr-3.pt-3
              v-radio-group.ml-3.py-0(v-model='tgt.mode')
                v-radio(
                  label='Bi-directional'
                  color='primary'
                  value='sync'
                )
                v-radio(
                  label='Push to target'
                  color='primary'
                  value='push'
                )
                v-radio(
                  label='Pull from target'
                  color='primary'
                  value='pull'
                )
            .body-1.ml-3
              strong Bi-directional
              .pb-3 In bi-directional mode, content is first pulled from the storage target. Any newer content overwrites local content. New content since last sync is then pushed to the storage target, overwriting any content on target if present.
              strong Push to target
              .pb-3 Content is always pushed to the storage target, overwriting any existing content. This is the default and safest choice for backup scenarios.
              strong Pull from target
              .pb-3 Content is always pulled from the storage target, overwriting any local content which already exists. This choice is usually reserved for single-use content import. Caution with this option as any local content will always be overwritten!

    v-card-chin
      v-btn(color='primary', @click='save')
        v-icon(left) chevron_right
        span Apply Configuration
      v-spacer
      v-btn(icon, @click='refresh')
        v-icon.grey--text refresh

</template>

<script>
import _ from 'lodash'

import targetsQuery from 'gql/admin/storage/storage-query-targets.gql'
import targetsSaveMutation from 'gql/admin/storage/storage-mutation-save-targets.gql'

export default {
  data() {
    return {
      targets: []
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
            'mode'
          ]))
        }
      })
      this.$store.commit('showNotification', {
        message: 'Storage configuration saved successfully.',
        style: 'success',
        icon: 'check'
      })
      this.$store.commit(`loadingStop`, 'admin-storage-savetargets')
    }
  },
  apollo: {
    targets: {
      query: targetsQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.storage.targets),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-storage-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
