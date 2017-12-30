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

        svg.icons.is-24(role='img', v-if='subtitleIcon')
          title {{subtitleText}}
          use(:xlink:href='subtitleIconClass')
        h2 {{subtitleText}}
      .navigator-action
        .navigator-action-item
          svg.icons.is-32(role='img')
            title User
            use(xlink:href='#nc-user-circle')
    .navigator-row
      .navigator-nav
</template>

<script>
/* global CONSTANTS, graphQL, siteConfig */

import { mapState } from 'vuex'

export default {
  name: 'navigator',
  data() {
    return { }
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
      this.$store.dispatch('navigator/alert', {
        style: 'success',
        icon: 'nc-check-simple',
        msg: 'Changes were saved successfully!'
      })
    }
  },
  mounted() {
  }
}
</script>
