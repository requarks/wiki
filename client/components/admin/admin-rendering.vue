<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header-icon: v-icon(size='80', color='grey lighten-2') system_update_alt
        .headline.primary--text Rendering
        .subheading.grey--text Configure how content is rendered
        v-layout.mt-3(row wrap)
          v-flex(lg3 xs12)
            v-toolbar(
              color='primary'
              dense
              flat
              dark
              )
              v-icon.mr-2 line_weight
              .subheading Pipeline
            v-expansion-panel.adm-rendering-pipeline(v-model='selectedCore')
              v-expansion-panel-content(
                hide-actions
                v-for='core in renderers'
                :key='core.key'
                )
                v-toolbar(
                  slot='header'
                  color='blue'
                  dense
                  dark
                  flat
                  )
                  v-spacer
                  .body-2 {{core.input}}
                  v-icon.mx-2 arrow_forward
                  .caption {{core.output}}
                  v-spacer
                v-list.py-0(two-line, dense)
                  template(v-for='(rdr, n) in core.children')
                    v-list-tile(
                      avatar
                      :key='rdr.key'
                      @click='selectRenderer(rdr.key)'
                      :class='currentRenderer.key === rdr.key ? "blue lighten-5" : ""'
                      )
                      v-list-tile-avatar
                        v-icon(:color='currentRenderer.key === rdr.key ? "primary" : "grey"') {{rdr.icon}}
                      v-list-tile-content
                        v-list-tile-title {{rdr.title}}
                        v-list-tile-sub-title {{rdr.description}}
                      v-list-tile-avatar
                        status-indicator(v-if='rdr.isEnabled', positive, pulse)
                        status-indicator(v-else, negative, pulse)
                    v-divider.my-0(v-if='n < core.children.length - 1')

          v-flex(lg9 xs12)
            v-card
              v-toolbar(
                color='grey darken-1'
                dark
                flat
                dense
                )
                v-icon.mr-2 {{currentRenderer.icon}}
                .subheading {{currentRenderer.title}}
                v-spacer
                .pt-3.mt-1
                  v-switch(
                    dark
                    color='white'
                    label='Enabled'
                    v-model='currentRenderer.isEnabled'
                    )
              v-card-text.pb-4.pt-2.pl-4
                v-subheader.pl-0 Rendering Module Configuration
                .body-1.ml-3(v-if='!currentRenderer.config || currentRenderer.config.length < 1') This rendering module has no configuration options you can modify.
                template(v-else, v-for='(cfg, idx) in currentRenderer.config')
                  v-select(
                    v-if='cfg.value.type === "string" && cfg.value.enum'
                    outline
                    background-color='grey lighten-2'
                    :items='cfg.value.enum'
                    :key='cfg.key'
                    :label='cfg.value.title'
                    v-model='cfg.value.value'
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
                    :hint='cfg.value.hint ? cfg.value.hint : ""'
                    persistent-hint
                    :class='cfg.value.hint ? "mb-2" : ""'
                    )
                  v-divider.my-3(v-if='idx < currentRenderer.config.length - 1')
              v-card-chin
                v-btn(
                  color='primary'
                  )
                  v-icon(left) check
                  span Apply Configuration
                v-spacer
                .caption.pr-3.grey--text Module: {{ currentRenderer.key }}
</template>

<script>
import _ from 'lodash'
import { DepGraph } from 'dependency-graph'

import { StatusIndicator } from 'vue-status-indicator'

import renderersQuery from 'gql/admin/rendering/rendering-query-renderers.gql'

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
    }
  },
  apollo: {
    renderers: {
      query: renderersQuery,
      fetchPolicy: 'network-only',
      update: (data) => {
        let renderers = _.cloneDeep(data.rendering.renderers).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.parse(cfg.value)}))}))
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
  border-top: 1px solid #FFF;

  .v-expansion-panel__header {
    padding: 0 0;
  }
}
</style>
