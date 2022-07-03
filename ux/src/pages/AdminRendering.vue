<template lang='pug'>
q-page.admin-mail
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-rich-text-converter.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.rendering.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.rendering.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.js.wiki/admin/rendering'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='mdi-check'
        :label='$t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='loading > 0'
      )
  q-separator(inset)
  //- v-container(fluid, grid-list-lg)
  //-   v-layout(row, wrap)
  //-     v-flex(xs12)
  //-       .admin-header
  //-         img.animated.fadeInUp(src='/_assets/svg/icon-process.svg', alt='Rendering', style='width: 80px;')
  //-         .admin-header-title
  //-           .headline.primary--text.animated.fadeInLeft {{ $t('admin.rendering.title') }}
  //-           .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin.rendering.subtitle') }}
  //-         v-spacer
  //-         v-btn.animated.fadeInDown.wait-p3s(icon, outlined, color='grey', href='https://docs.requarks.io/rendering', target='_blank')
  //-           v-icon mdi-help-circle
  //-         v-btn.mx-3.animated.fadeInDown.wait-p2s(icon, outlined, color='grey', @click='refresh')
  //-           v-icon mdi-refresh
  //-         v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
  //-           v-icon(left) mdi-check
  //-           span {{$t('common.actions.apply')}}

  //-     v-flex.animated.fadeInUp(lg3, xs12)
  //-       v-toolbar(
  //-         color='blue darken-2'
  //-         dense
  //-         flat
  //-         dark
  //-         )
  //-         .subtitle-1 Pipeline
  //-       v-expansion-panels.adm-rendering-pipeline(
  //-         v-model='selectedCore'
  //-         accordion
  //-         mandatory
  //-         )
  //-         v-expansion-panel(
  //-           v-for='core in renderers'
  //-           :key='core.key'
  //-           )
  //-           v-expansion-panel-header(
  //-             hide-actions
  //-             ripple
  //-           )
  //-             v-toolbar(
  //-               color='blue'
  //-               dense
  //-               dark
  //-               flat
  //-               )
  //-               v-spacer
  //-               .body-2 {{core.input}}
  //-               v-icon.mx-2 mdi-arrow-right-circle
  //-               .caption {{core.output}}
  //-               v-spacer
  //-           v-expansion-panel-content
  //-             v-list.py-0(two-line, dense)
  //-               template(v-for='(rdr, n) in core.children')
  //-                 v-list-item(
  //-                   :key='rdr.key'
  //-                   @click='selectRenderer(rdr.key)'
  //-                   :class='currentRenderer.key === rdr.key ? ($vuetify.theme.dark ? `grey darken-4-l4` : `blue lighten-5`) : ``'
  //-                   )
  //-                   v-list-item-avatar(size='24', tile)
  //-                     v-icon(:color='currentRenderer.key === rdr.key ? "primary" : "grey"') {{rdr.icon}}
  //-                   v-list-item-content
  //-                     v-list-item-title {{rdr.title}}
  //-                     v-list-item-subtitle: .caption {{rdr.description}}
  //-                   v-list-item-avatar(size='24')
  //-                     status-indicator(v-if='rdr.isEnabled', positive, pulse)
  //-                     status-indicator(v-else, negative, pulse)
  //-                 v-divider.my-0(v-if='n < core.children.length - 1')

  //-     v-flex(lg9, xs12)
  //-       v-card.wiki-form.animated.fadeInUp
  //-         v-toolbar(
  //-           color='indigo'
  //-           dark
  //-           flat
  //-           dense
  //-           )
  //-           v-icon.mr-2 {{currentRenderer.icon}}
  //-           .subtitle-1 {{currentRenderer.title}}
  //-           v-spacer
  //-           v-switch(
  //-             dark
  //-             color='white'
  //-             label='Enabled'
  //-             v-model='currentRenderer.isEnabled'
  //-             hide-details
  //-             inset
  //-             )
  //-         v-card-info(color='blue')
  //-           div
  //-             div {{currentRenderer.description}}
  //-             span.caption: a(href='https://docs.requarks.io/en/rendering', target='_blank') Documentation
  //-         v-card-text.pb-4.pl-4
  //-           .overline.mb-5 Rendering Module Configuration
  //-           .body-2.ml-3(v-if='!currentRenderer.config || currentRenderer.config.length < 1'): em This rendering module has no configuration options you can modify.
  //-           template(v-else, v-for='(cfg, idx) in currentRenderer.config')
  //-             v-select(
  //-               v-if='cfg.value.type === "string" && cfg.value.enum'
  //-               outlined
  //-               :items='cfg.value.enum'
  //-               :key='cfg.key'
  //-               :label='cfg.value.title'
  //-               v-model='cfg.value.value'
  //-               :hint='cfg.value.hint ? cfg.value.hint : ""'
  //-               persistent-hint
  //-               :class='cfg.value.hint ? "mb-2" : ""'
  //-               color='indigo'
  //-             )
  //-             v-switch(
  //-               v-else-if='cfg.value.type === "boolean"'
  //-               :key='cfg.key'
  //-               :label='cfg.value.title'
  //-               v-model='cfg.value.value'
  //-               color='indigo'
  //-               :hint='cfg.value.hint ? cfg.value.hint : ""'
  //-               persistent-hint
  //-               inset
  //-               )
  //-             v-text-field(
  //-               v-else
  //-               outlined
  //-               :key='cfg.key'
  //-               :label='cfg.value.title'
  //-               v-model='cfg.value.value'
  //-               :hint='cfg.value.hint ? cfg.value.hint : ""'
  //-               persistent-hint
  //-               :class='cfg.value.hint ? "mb-2" : ""'
  //-               color='indigo'
  //-               )
  //-             v-divider.my-5(v-if='idx < currentRenderer.config.length - 1')
  //-         v-card-chin
  //-           v-spacer
  //-           .caption.pr-3.grey--text Module: {{ currentRenderer.key }}
</template>

<script>
import { cloneDeep, concat, filter, find, findIndex, reduce, reverse, sortBy } from 'lodash-es'
import { DepGraph } from 'dependency-graph'
import gql from 'graphql-tag'

export default {
  data () {
    return {
      selectedCore: -1,
      renderers: [],
      currentRenderer: {}
    }
  },
  watch: {
    renderers (newValue, oldValue) {
      setTimeout(() => {
        this.selectedCore = findIndex(newValue, ['key', 'markdownCore'])
        this.selectRenderer('markdownCore')
      }, 500)
    }
  },
  methods: {
    async load () {
      this.loading++
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query getRenderingConfig {
              mailConfig {
                senderName
                senderEmail
                host
                port
                secure
                verifySSL
                user
                pass
                useDKIM
                dkimDomainName
                dkimKeySelector
                dkimPrivateKey
              }
            }
          `,
          fetchPolicy: 'no-cache'
        })
        if (!resp?.data?.mailConfig) {
          throw new Error('Failed to fetch mail config.')
        }
        const renderers = cloneDeep(resp.data.rendering.renderers).map(str => ({
          ...str,
          config: sortBy(str.config.map(cfg => ({
            ...cfg,
            value: JSON.parse(cfg.value)
          })), [t => t.value.order])
        }))
        // Build tree
        const graph = new DepGraph({ circular: true })
        const rawCores = filter(renderers, ['dependsOn', null]).map(core => {
          core.children = concat([cloneDeep(core)], filter(renderers, ['dependsOn', core.key]))
          return core
        })
        // Build dependency graph
        rawCores.forEach(core => { graph.addNode(core.key) })
        rawCores.forEach(core => {
          rawCores.forEach(coreTarget => {
            if (core.key !== coreTarget.key) {
              if (core.output === coreTarget.input) {
                graph.addDependency(core.key, coreTarget.key)
              }
            }
          })
        })
        // Reorder cores in reverse dependency order
        const orderedCores = []
        reverse(graph.overallOrder()).forEach(coreKey => {
          orderedCores.push(find(rawCores, ['key', coreKey]))
        })
        this.renderers = orderedCores
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: 'Failed to fetch mail config',
          caption: err.message
        })
      }
      this.loading--
    },
    selectRenderer (key) {
      this.renderers.forEach(rdr => {
        if (rdr.children.some(c => c.key === key)) {
          this.currentRenderer = find(rdr.children, ['key', key])
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
      this.$store.commit('loadingStart', 'admin-rendering-saverenderers')
      await this.$apollo.mutate({
        mutation: null,
        variables: {
          renderers: reduce(this.renderers, (result, core) => {
            result.push(...core.children.map(rd => ({
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
      this.$store.commit('loadingStop', 'admin-rendering-saverenderers')
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
