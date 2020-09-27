<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-process.svg', alt='Rendering', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:rendering.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:rendering.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p3s(icon, outlined, color='grey', href='https://docs.requarks.io/rendering', target='_blank')
            v-icon mdi-help-circle
          v-btn.mx-3.animated.fadeInDown.wait-p2s(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

      v-flex.animated.fadeInUp(lg3, xs12)
        v-toolbar(
          color='blue darken-2'
          dense
          flat
          dark
          )
          .subtitle-1 Pipeline
        v-expansion-panels.adm-rendering-pipeline(
          v-model='selectedCore'
          accordion
          mandatory
          )
          v-expansion-panel(
            v-for='core in renderers'
            :key='core.key'
            )
            v-expansion-panel-header(
              hide-actions
              ripple
            )
              v-toolbar(
                color='blue'
                dense
                dark
                flat
                )
                v-spacer
                .body-2 {{core.input}}
                v-icon.mx-2 mdi-arrow-right-circle
                .caption {{core.output}}
                v-spacer
            v-expansion-panel-content
              v-list.py-0(two-line, dense)
                template(v-for='(rdr, n) in core.children')
                  v-list-item(
                    :key='rdr.key'
                    @click='selectRenderer(rdr.key)'
                    :class='currentRenderer.key === rdr.key ? ($vuetify.theme.dark ? `grey darken-4-l4` : `blue lighten-5`) : ``'
                    )
                    v-list-item-avatar(size='24', tile)
                      v-icon(:color='currentRenderer.key === rdr.key ? "primary" : "grey"') {{rdr.icon}}
                    v-list-item-content
                      v-list-item-title {{rdr.title}}
                      v-list-item-subtitle: .caption {{rdr.description}}
                    v-list-item-avatar(size='24')
                      status-indicator(v-if='rdr.isEnabled', positive, pulse)
                      status-indicator(v-else, negative, pulse)
                  v-divider.my-0(v-if='n < core.children.length - 1')

      v-flex(lg9, xs12)
        v-card.wiki-form.animated.fadeInUp
          v-toolbar(
            color='indigo'
            dark
            flat
            dense
            )
            v-icon.mr-2 {{currentRenderer.icon}}
            .subtitle-1 {{currentRenderer.title}}
            v-spacer
            v-switch(
              dark
              color='white'
              label='Enabled'
              v-model='currentRenderer.isEnabled'
              hide-details
              inset
              )
          v-card-info(color='blue')
            div
              div {{currentRenderer.description}}
              span.caption: a(href='https://docs.requarks.io/en/rendering', target='_blank') Documentation
          v-card-text.pb-4.pl-4
            .overline.mb-5 Rendering Module Configuration
            .body-2.ml-3(v-if='!currentRenderer.config || currentRenderer.config.length < 1'): em This rendering module has no configuration options you can modify.
            template(v-else, v-for='(cfg, idx) in currentRenderer.config')
              v-select(
                v-if='cfg.value.type === "string" && cfg.value.enum'
                outlined
                :items='cfg.value.enum'
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                :class='cfg.value.hint ? "mb-2" : ""'
                color='indigo'
              )
              v-switch(
                v-else-if='cfg.value.type === "boolean"'
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                color='indigo'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                inset
                )
              v-text-field(
                v-else
                outlined
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                :class='cfg.value.hint ? "mb-2" : ""'
                color='indigo'
                )
              v-divider.my-5(v-if='idx < currentRenderer.config.length - 1')
          v-card-chin
            v-spacer
            .caption.pr-3.grey--text Module: {{ currentRenderer.key }}
</template>

<script>
import _ from 'lodash'
import { DepGraph } from 'dependency-graph'

import { StatusIndicator } from 'vue-status-indicator'

import renderersQuery from 'gql/admin/rendering/rendering-query-renderers.gql'
import renderersSaveMutation from 'gql/admin/rendering/rendering-mutation-save-renderers.gql'

export default {
  components: {
    StatusIndicator
  },
  data() {
    return {
      selectedCore: -1,
      renderers: [],
      currentRenderer: {}
    }
  },
  watch: {
    renderers(newValue, oldValue) {
      _.delay(() => {
        this.selectedCore = _.findIndex(newValue, ['key', 'markdownCore'])
        this.selectRenderer('markdownCore')
      }, 500)
    }
  },
  methods: {
    selectRenderer (key) {
      this.renderers.map(rdr => {
        if (_.some(rdr.children, ['key', key])) {
          this.currentRenderer = _.find(rdr.children, ['key', key])
        }
      })
    },
    async refresh () {
      await this.$apollo.queries.renderers.refetch()
      this.$store.commit('showNotification', {
        message: 'Rendering active configuration has been reloaded.',
        style: 'success',
        icon: 'cached'
      })
    },
    async save () {
      this.$store.commit(`loadingStart`, 'admin-rendering-saverenderers')
      await this.$apollo.mutate({
        mutation: renderersSaveMutation,
        variables: {
          renderers: _.reduce(this.renderers, (result, core) => {
            result = _.concat(result, core.children.map(rd => ({
              key: rd.key,
              isEnabled: rd.isEnabled,
              config: rd.config.map(cfg => ({ key: cfg.key, value: JSON.stringify({ v: cfg.value.value }) }))
            })))
            return result
          }, [])
        }
      })
      this.$store.commit('showNotification', {
        message: 'Rendering configuration saved successfully.',
        style: 'success',
        icon: 'check'
      })
      this.$store.commit(`loadingStop`, 'admin-rendering-saverenderers')
    }
  },
  apollo: {
    renderers: {
      query: renderersQuery,
      fetchPolicy: 'network-only',
      update: (data) => {
        let renderers = _.cloneDeep(data.rendering.renderers).map(str => ({
          ...str,
          config: _.sortBy(str.config.map(cfg => ({
            ...cfg,
            value: JSON.parse(cfg.value)
          })), [t => t.value.order])
        }))
        // Build tree
        const graph = new DepGraph({ circular: true })
        const rawCores = _.filter(renderers, ['dependsOn', null]).map(core => {
          core.children = _.concat([_.cloneDeep(core)], _.filter(renderers, ['dependsOn', core.key]))
          return core
        })
        // Build dependency graph
        rawCores.map(core => { graph.addNode(core.key) })
        rawCores.map(core => {
          rawCores.map(coreTarget => {
            if (core.key !== coreTarget.key) {
              if (core.output === coreTarget.input) {
                graph.addDependency(core.key, coreTarget.key)
              }
            }
          })
        })
        // Reorder cores in reverse dependency order
        let orderedCores = []
        _.reverse(graph.overallOrder()).map(coreKey => {
          orderedCores.push(_.find(rawCores, ['key', coreKey]))
        })
        return orderedCores
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-rendering-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.adm-rendering-pipeline {
  .v-expansion-panel--active .v-expansion-panel-header {
    min-height: 0;
  }

  .v-expansion-panel-header {
    padding: 0;
    margin-top: 1px;
  }

  .v-expansion-panel-content__wrap {
    padding: 0;
  }
}
</style>
