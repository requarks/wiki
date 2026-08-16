<template lang='pug'>
  nav-bottom-bar(v-if='visible')
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'

import NavBottomBar from './nav-bottom-bar.vue'

export default {
  components: {
    NavBottomBar
  },
  data () {
    return {
      mobileViewport: typeof window !== 'undefined' ? window.innerWidth < 960 : false
    }
  },
  computed: {
    printView: get('site/printView'),
    mode: get('page/mode'),
    visible () {
      if (!this.mobileViewport) { return false }
      if (this.printView) { return false }
      if (this.mode === 'edit') { return false }
      const root = document.getElementById('root')
      if (root && root.classList.contains('is-fullscreen')) { return false }
      return true
    }
  },
  watch: {
    visible: {
      immediate: true,
      handler (val) {
        document.body.classList.toggle('has-mobile-bottom-nav', val)
      }
    }
  },
  mounted () {
    this._onResize = _.debounce(() => {
      this.mobileViewport = window.innerWidth < 960
    }, 100)
    window.addEventListener('resize', this._onResize)
  },
  beforeDestroy () {
    document.body.classList.remove('has-mobile-bottom-nav')
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize)
    }
  }
}
</script>

<style lang='scss'>
body.has-mobile-bottom-nav {
  overflow-x: hidden;

  .v-application,
  .v-application--wrap {
    overflow-x: hidden;
    max-width: 100vw;
  }

  .v-main__wrap,
  .v-content__wrap {
    padding-bottom: 56px !important;
  }

  .v-footer {
    margin-bottom: 56px;
  }

  .nav-bottom-bar {
    z-index: 220 !important;
  }

  .v-dialog__content {
    z-index: 230 !important;
  }

  .v-menu__content {
    z-index: 230 !important;
  }

  @media #{map-get($display-breakpoints, 'sm-and-down')} {
    .nav-drawer-shell.v-navigation-drawer--temporary,
    .v-navigation-drawer--temporary.nav-drawer-mobile,
    .v-navigation-drawer--temporary.admin-sidebar-mobile,
    .v-navigation-drawer--temporary.tags-sidebar-mobile,
    .v-navigation-drawer--temporary.profile-sidebar-mobile {
      z-index: 240 !important;
      top: 0 !important;
      bottom: 0 !important;
      height: 100% !important;
      max-height: 100vh !important;
    }

    .v-overlay--active {
      z-index: 235 !important;
    }

    .v-overlay--active:has(+ .v-dialog__content) {
      z-index: 229 !important;
    }

    .v-dialog__content .v-card:not(.page-selector) {
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 24px);
      overflow: hidden;
    }

    .v-dialog__content .v-card .dialog-header {
      flex: 0 0 auto;
    }

    .v-dialog__content .v-card:not(.page-selector) > .d-flex,
    .v-dialog__content .v-card > .v-card__text {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
    }

    .v-dialog__content .v-card > .v-card-actions,
    .v-dialog__content .v-card > div:last-child {
      flex: 0 0 auto;
    }
  }
}
</style>
