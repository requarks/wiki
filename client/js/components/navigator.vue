<template lang="pug">
  .navigator
    .navigator-bar
      .navigator-fab
        .navigator-fab-button(@click='toggleMainMenu')
          svg.icons.is-24(role='img')
            title Navigation
            use(xlink:href='#gg-apps-grid')
      .navigator-title
        h1 {{ siteTitle }}
      .navigator-subtitle(:class='subtitleClass')
        transition(name='navigator-subtitle-icon')
          svg.icons.is-24.navigator-subtitle-icon(role='img', v-if='subtitleIcon')
            title {{subtitleText}}
            use(:xlink:href='subtitleIconClass')
        h2 {{subtitleText}}
      .navigator-action
        .navigator-action-item
          svg.icons.is-32(role='img')
            title User
            use(xlink:href='#nc-user-circle')
    transition(name='navigator-sd')
      .navigator-sd(v-show='sdShown')
        .navigator-sd-actions
          a.is-active(href='', title='Search')
            svg.icons.is-24(role='img')
              title Search
              use(xlink:href='#gg-search')
          a(href='', title='New Document')
            svg.icons.is-24(role='img')
              title New Document
              use(xlink:href='#nc-plus-circle')
          a(href='', title='Edit Document')
            svg.icons.is-24(role='img')
              title Edit Document
              use(xlink:href='#nc-pen-red')
          a(href='', title='History')
            svg.icons.is-24(role='img')
              title History
              use(xlink:href='#nc-restore')
          a(href='', title='View Source')
            svg.icons.is-24(role='img')
              title View Source
              use(xlink:href='#nc-code-editor')
          a(href='', title='Move Document')
            svg.icons.is-24(role='img')
              title Move Document
              use(xlink:href='#nc-move')
          a(href='', title='Delete Document')
            svg.icons.is-24(role='img')
              title Delete Document
              use(xlink:href='#nc-trash')
        .navigator-sd-search
          input(type='text', ref='iptSearch', placeholder='Search')
        .navigator-sd-results
        .navigator-sd-footer
          a(href='', title='Settings')
            svg.icons.is-24(role='img')
              title Settings
              use(xlink:href='#nc-gear')
          a(href='', title='Users')
            svg.icons.is-24(role='img')
              title Users
              use(xlink:href='#nc-users')
          a(href='', title='Assets')
            svg.icons.is-24(role='img')
              title Assets
              use(xlink:href='#nc-image')
</template>

<script>
/* global CONSTANTS, graphQL, siteConfig */

import { mapState } from 'vuex'

export default {
  name: 'navigator',
  data() {
    return {
      sdShown: false
    }
  },
  computed: {
    ...mapState('navigator', [
      'subtitleShown',
      'subtitleStyle',
      'subtitleText',
      'subtitleIcon'
    ]),
    siteTitle() {
      return siteConfig.title
    },
    subtitleClass() {
      return {
        'is-active': this.subtitleShown,
        'is-error': this.subtitleStyle === 'error',
        'is-warning': this.subtitleStyle === 'warning',
        'is-success': this.subtitleStyle === 'success',
        'is-info': this.subtitleStyle === 'info'
      }
    },
    subtitleIconClass() { return '#' + this.subtitleIcon }
  },
  methods: {
    toggleMainMenu() {
      this.sdShown = !this.sdShown
      if (this.sdShown) {
        this.$nextTick(() => {
          this.$refs.iptSearch.focus()
        })
      }
      // this.$store.dispatch('navigator/alert', {
      //   style: 'success',
      //   icon: 'gg-check',
      //   msg: 'Changes were saved successfully!'
      // })
    }
  },
  mounted() {
  }
}
</script>
