<template lang='pug'>
  .editor-api
    .editor-api-main
      v-list.editor-api-sidebar.radius-0(nav, :class='$vuetify.theme.dark ? `grey darken-4` : `primary`', dark)
        v-list-item-group(v-model='tab')
          v-list-item.animated.fadeInLeft(value='info')
            v-list-item-icon: v-icon mdi-book-information-variant
            v-list-item-title Info
          v-list-item.mt-3.animated.fadeInLeft.wait-p2s(value='servers')
            v-list-item-icon: v-icon mdi-server
            v-list-item-title Servers
          v-list-item.mt-3.animated.fadeInLeft.wait-p3s(value='endpoints')
            v-list-item-icon: v-icon mdi-code-braces
            v-list-item-title Endpoints
          v-list-item.mt-3.animated.fadeInLeft.wait-p4s(value='models')
            v-list-item-icon: v-icon mdi-buffer
            v-list-item-title Models
          v-list-item.mt-3.animated.fadeInLeft.wait-p5s(value='auth')
            v-list-item-icon: v-icon mdi-lock
            v-list-item-title Authentication
      .editor-api-editor
        template(v-if='tab === `info`')
          v-container.px-2.pt-1(fluid)
            v-row(dense)
              v-col(cols='12')
                .pa-3
                  .subtitle-2 API General Information
                  .caption.grey--text.text--darken-1 Global metadata about the API
              v-col(cols='12', lg='6')
                v-card.pt-2
                  v-card-text
                    v-text-field(
                      label='Title'
                      outlined
                      hint='Required - Title of the API'
                      persistent-hint
                      v-model='info.title'
                    )
                    v-divider.mt-2.mb-4
                    v-text-field(
                      label='Version'
                      outlined
                      hint='Required - Semantic versioning like 1.0.0 or an arbitrary string like 0.99-beta.'
                      persistent-hint
                      v-model='info.version'
                    )
                    v-divider.mt-2.mb-4
                    v-textarea(
                      label='Description'
                      outlined
                      hint='Optional - Markdown formatting is supported.'
                      persistent-hint
                      v-model='info.description'
                    )
              v-col(cols='12', lg='6')
                v-card.pt-2
                  v-card-text
                    v-list(nav, two-line)
                      v-list-item-group(v-model='kind', mandatory, color='primary')
                        v-list-item(value='rest')
                          v-list-item-avatar
                            img(src='/_assets/svg/icon-transaction-list.svg', alt='REST')
                          v-list-item-content
                            v-list-item-title REST API
                            v-list-item-subtitle Classic REST Endpoints
                          v-list-item-avatar
                            v-icon(:color='kind === `rest` ? `primary` : `grey lighten-3`') mdi-check-circle
                        v-list-item(value='graphql', disabled)
                          v-list-item-avatar
                            img(src='/_assets/svg/icon-graphql.svg', alt='GraphQL')
                          v-list-item-content
                            v-list-item-title GraphQL
                            v-list-item-subtitle.grey--text.text--lighten-1 Schema-based API
                          v-list-item-action
                            //- v-icon(:color='kind === `graphql` ? `primary` : `grey lighten-3`') mdi-check-circle
                            v-chip(label, small) Coming soon
        template(v-else-if='tab === `servers`')
          v-container.px-2.pt-1(fluid)
            v-row(dense)
              v-col(cols='12')
                .pa-3
                  .d-flex.align-center.justify-space-between
                    div
                      .subtitle-2 List of servers / load balancers where this API reside
                      .caption.grey--text.text--darken-1 Enter all environments, e.g. Integration, QA, Pre-production, Production, etc.
                    v-btn(color='primary', large, @click='addServer')
                      v-icon(left) mdi-plus
                      span Add Server
              v-col(cols='12', lg='6', v-for='srv of servers', :key='srv.id')
                v-card.pt-1
                  v-card-text
                    .d-flex
                      .d-flex.flex-column.justify-space-between
                        v-menu(offset-y, min-width='200')
                          template(v-slot:activator='{ on }')
                            v-btn(text, x-large, style='min-width: 0;', v-on='on')
                              v-icon(large, :color='iconColor(srv.icon)') {{iconKey(srv.icon)}}
                          v-list(nav, dense)
                            v-list-item-group(v-model='srv.icon', mandatory)
                              v-list-item(:value='srvKey', v-for='(srv, srvKey) in serverTypes', :key='srvKey')
                                v-list-item-icon: v-icon(large, :color='srv.color', v-text='srv.icon')
                                v-list-item-content: v-list-item-title(v-text='srv.title')
                        v-btn.mb-2(depressed, small, @click='removeServer(srv.id)')
                          v-icon(left) mdi-close
                          span Delete
                      v-divider.ml-5(vertical)
                      .pl-5(style='flex: 1 1 100%;')
                        v-text-field(
                          label='Environment / Server Name'
                          outlined
                          hint='Required - Name of the environment (e.g. QA, Production)'
                          persistent-hint
                          v-model='srv.name'
                        )
                        v-text-field.mt-4(
                          label='URL'
                          outlined
                          hint='Required - URL of the environment (e.g. https://api.example.com/v1)'
                          persistent-hint
                          v-model='srv.url'
                        )

        template(v-else-if='tab === `endpoints`')
          v-container.px-2.pt-1(fluid)
            v-row(dense)
              v-col(cols='12')
                .pa-3
                  .d-flex.align-center.justify-space-between
                    div
                      .subtitle-2 List of endpoints
                      .caption.grey--text.text--darken-1 Groups of REST endpoints (GET, POST, PUT, DELETE).
                    v-btn(color='primary', large, @click='addGroup')
                      v-icon(left) mdi-plus
                      span Add Group
              v-col(cols='12', v-for='grp of endpointGroups', :key='grp.id')
                v-card(color='grey darken-2')
                  v-card-text
                    v-toolbar(color='grey darken-2', flat, height='86')
                      v-text-field.mr-1(
                        flat
                        dark
                        label='Group Name'
                        solo
                        hint='Group Name'
                        persistent-hint
                        v-model='grp.name'
                      )
                      v-text-field.mx-1(
                        flat
                        dark
                        label='Group Description'
                        solo
                        hint='Group Description'
                        persistent-hint
                        v-model='grp.description'
                      )
                      v-divider.mx-3(vertical, dark)
                      v-btn.mx-1.align-self-start(color='grey lighten-2', @click='addEndpoint(grp)', dark, text, height='48')
                        v-icon(left) mdi-trash-can
                        span Delete
                      v-divider.mx-3(vertical, dark)
                      v-btn.ml-1.align-self-start(color='pink', @click='addEndpoint(grp)', dark, depressed, height='48')
                        v-icon(left) mdi-plus
                        span Add Endpoint
                    v-container.pa-0.mt-2(fluid)
                      v-row(dense)
                        v-col(cols='12', v-for='ept of grp.endpoints', :key='ept.id')
                          v-card.pt-1
                            v-card-text
                              .d-flex
                                .d-flex.flex-column
                                  v-menu(offset-y, min-width='140')
                                    template(v-slot:activator='{ on }')
                                      v-btn.subtitle-1(depressed, large, dark, style='min-width: 140px;', height='48', v-on='on', :color='methodColor(ept.method)')
                                        strong {{ept.method}}
                                    v-list(nav, dense)
                                      v-list-item-group(v-model='ept.method', mandatory)
                                        v-list-item(:value='mtd.key', v-for='mtd of endpointMethods', :key='mtd.key')
                                          v-list-item-content
                                            v-chip.text-center(label, :color='mtd.color', dark) {{mtd.key}}
                                  v-btn.mt-2(v-if='!ept.expanded', small, @click='ept.expanded = true', color='pink', outlined)
                                    v-icon(left) mdi-arrow-down-box
                                    span Expand
                                  v-btn.mt-2(v-else, small, @click='ept.expanded = false', color='pink', outlined)
                                    v-icon(left) mdi-arrow-up-box
                                    span Collapse
                                  template(v-if='ept.expanded')
                                    v-spacer
                                    v-btn.my-2(depressed, small, @click='removeEndpoint(grp, ept.id)')
                                      v-icon(left) mdi-close
                                      span Delete
                                v-divider.ml-5(vertical)
                                .pl-5(style='flex: 1 1 100%;')
                                  .d-flex
                                    v-text-field.mr-2(
                                      label='Path'
                                      outlined
                                      hint='Required - Path to the endpoint (e.g. /planets/{planetId})'
                                      persistent-hint
                                      v-model='ept.path'
                                    )
                                    v-text-field.ml-2(
                                      label='Summary'
                                      outlined
                                      hint='Required - A short summary of the endpoint (a few words).'
                                      persistent-hint
                                      v-model='ept.summary'
                                    )
                                  template(v-if='ept.expanded')
                                    v-text-field.mt-3(
                                      label='Description'
                                      outlined
                                      v-model='ept.description'
                                    )

    v-system-bar.editor-api-sysbar(dark, status, color='grey darken-3')
      .caption.editor-api-sysbar-locale {{locale.toUpperCase()}}
      .caption.px-3 /{{path}}
      template(v-if='$vuetify.breakpoint.mdAndUp')
        v-spacer
        .caption API Docs
        v-spacer
        .caption OpenAPI 3.0
</template>

<script>
import _ from 'lodash'
import { v4 as uuid } from 'uuid'
import { get, sync } from 'vuex-pathify'

export default {
  data() {
    return {
      tab: `endpoints`,
      kind: 'rest',
      kinds: [
        { text: 'REST', value: 'rest' },
        { text: 'GraphQL', value: 'graphql' }
      ],
      info: {
        title: '',
        version: '1.0.0',
        description: ''
      },
      servers: [
        { name: 'Production', url: 'https://api.example.com/v1', icon: 'server', id: '123456' }
      ],
      serverTypes: {
        aws: {
          color: 'orange',
          icon: 'mdi-aws',
          title: 'AWS'
        },
        azure: {
          color: 'blue darken-2',
          icon: 'mdi-azure',
          title: 'Azure'
        },
        digitalocean: {
          color: 'blue',
          icon: 'mdi-digital-ocean',
          title: 'DigitalOcean'
        },
        docker: {
          color: 'blue',
          icon: 'mdi-docker',
          title: 'Docker'
        },
        google: {
          color: 'red',
          icon: 'mdi-google',
          title: 'Google'
        },
        kubernetes: {
          color: 'blue darken-2',
          icon: 'mdi-kubernetes',
          title: 'Kubernetes'
        },
        linux: {
          color: 'grey darken-3',
          icon: 'mdi-linux',
          title: 'Linux'
        },
        mac: {
          color: 'grey darken-2',
          icon: 'mdi-apple',
          title: 'Mac'
        },
        server: {
          color: 'grey',
          icon: 'mdi-server',
          title: 'Server'
        },
        windows: {
          color: 'blue darken-2',
          icon: 'mdi-windows',
          title: 'Windows'
        }
      },
      endpointGroups: [
        {
          id: '345678',
          name: '',
          description: '',
          endpoints: [
            { method: 'GET', path: '/pet', expanded: false, id: '234567' }
          ]
        }
      ],
      endpointMethods: [
        { key: 'GET', color: 'blue' },
        { key: 'POST', color: 'green' },
        { key: 'PUT', color: 'orange' },
        { key: 'PATCH', color: 'cyan' },
        { key: 'DELETE', color: 'red' },
        { key: 'HEAD', color: 'deep-purple' },
        { key: 'OPTIONS', color: 'blue-grey' }
      ]
    }
  },
  computed: {
    isMobile() {
      return this.$vuetify.breakpoint.smAndDown
    },
    locale: get('page/locale'),
    path: get('page/path'),
    mode: get('editor/mode'),
    activeModal: sync('editor/activeModal')
  },
  methods: {
    iconColor (val) {
      return _.get(this.serverTypes, `${val}.color`, 'white')
    },
    iconKey (val) {
      return _.get(this.serverTypes, `${val}.icon`, 'mdi-server')
    },
    methodColor (val) {
      return _.get(_.find(this.endpointMethods, ['key', val]), 'color', 'grey')
    },
    addServer () {
      this.servers.push({
        id: uuid(),
        name: 'Production',
        url: 'https://api.example.com/v1',
        icon: 'server'
      })
    },
    removeServer (id) {
      this.servers = _.reject(this.servers, ['id', id])
    },
    addGroup () {
      this.endpointGroups.push({
        id: uuid(),
        name: '',
        description: '',
        endpoints: []
      })
    },
    addEndpoint (grp) {
      grp.endpoints.push({
        id: uuid(),
        method: 'GET',
        path: '/pet',
        expanded: false
      })
    },
    removeEndpoint (grp, eptId) {
      grp.endpoints = _.reject(grp.endpoints, ['id', eptId])
    },
    toggleModal(key) {
      this.activeModal = (this.activeModal === key) ? '' : key
      this.helpShown = false
    },
    closeAllModal() {
      this.activeModal = ''
      this.helpShown = false
    }
  },
  mounted() {
    this.$store.set('editor/editorKey', 'api')

    if (this.mode === 'create') {
      this.$store.set('editor/content', '<h1>Title</h1>\n\n<p>Some text here</p>')
    }
  },
  beforeDestroy() {
    this.$root.$off('editorInsert')
  }
}
</script>

<style lang='scss'>
$editor-height: calc(100vh - 64px - 24px);
$editor-height-mobile: calc(100vh - 56px - 16px);

.editor-api {
  &-main {
    display: flex;
    width: 100%;
  }

  &-editor {
    background-color: darken(mc('grey', '100'), 4.5%);
    flex: 1 1 50%;
    display: block;
    height: $editor-height;
    position: relative;

    @at-root .theme--dark & {
      background-color: darken(mc('grey', '900'), 4.5%);
    }
  }

  &-sidebar {
    width: 200px;
  }

  &-sysbar {
    padding-left: 0 !important;

    &-locale {
      background-color: rgba(255,255,255,.25);
      display:inline-flex;
      padding: 0 12px;
      height: 24px;
      width: 63px;
      justify-content: center;
      align-items: center;
    }
  }

}
</style>
