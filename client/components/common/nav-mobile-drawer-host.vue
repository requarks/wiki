<template lang='pug'>
  v-navigation-drawer.nav-mobile-drawer-host(
    v-if='$vuetify.breakpoint.smAndDown'
    v-model='drawerShown'
    :app='true'
    fixed
    :clipped='true'
    :dark='drawerDark'
    :right='$vuetify.rtl'
    temporary
    :width='drawerWidth'
    overlay-color='black'
    :overlay-opacity='0.55'
    mobile-breakpoint='600'
    :class='drawerClass'
    )
    nav-drawer-mobile-header(@navigate='closeDrawer')
    vue-scroll(v-if='contentComponent', :ops='scrollStyle')
      component(:is='contentComponent', @navigate='closeDrawer')
</template>

<script>
import { get } from 'vuex-pathify'

import { getNavDrawerCategory } from './nav-drawer-category'
import NavDrawerMobileHeader from './nav-drawer-mobile-header.vue'
import NavDrawerContentAdmin from './nav-drawer-content-admin.vue'
import NavDrawerContentTags from './nav-drawer-content-tags.vue'
import NavDrawerContentProfile from './nav-drawer-content-profile.vue'
import NavDrawerContentWiki from './nav-drawer-content-wiki.vue'

const CONTENT_COMPONENTS = {
  admin: NavDrawerContentAdmin,
  tags: NavDrawerContentTags,
  profile: NavDrawerContentProfile,
  wiki: NavDrawerContentWiki
}

export default {
  components: {
    NavDrawerMobileHeader
  },
  data () {
    return {
      drawerShown: false,
      drawerCategory: getNavDrawerCategory(),
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollY: 0,
          initialScrollX: 0,
          scrollingX: false,
          easing: 'easeOutQuad',
          speed: 1000,
          verticalNativeBarPos: this.$vuetify.rtl ? 'left' : 'right'
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#CCC',
          hoverStyle: {
            background: '#999'
          }
        }
      }
    }
  },
  computed: {
    printView: get('site/printView'),
    drawerWidth () {
      return Math.min(Math.round(window.innerWidth * 0.88), 320)
    },
    drawerClass () {
      const suffix = this.drawerCategory === 'admin'
        ? 'admin-sidebar-mobile'
        : this.drawerCategory === 'tags'
          ? 'tags-sidebar-mobile'
          : this.drawerCategory === 'profile'
            ? 'profile-sidebar-mobile'
            : 'nav-drawer-mobile'
      return this.$vuetify.theme.dark ? `${suffix} blue darken-4` : `${suffix} primary`
    },
    drawerDark () {
      return true
    },
    contentComponent () {
      if (this.printView) { return null }
      return CONTENT_COMPONENTS[this.drawerCategory] || null
    }
  },
  watch: {
    '$route' () {
      this.drawerCategory = getNavDrawerCategory()
      this.closeDrawer()
    }
  },
  mounted () {
    this._onOpenNavDrawer = () => {
      this.drawerCategory = getNavDrawerCategory()
      this.drawerShown = true
    }
    this._onPopState = () => {
      this.drawerCategory = getNavDrawerCategory()
    }
    this.$root.$on('openNavDrawer', this._onOpenNavDrawer)
    window.addEventListener('popstate', this._onPopState)
  },
  beforeDestroy () {
    if (this._onOpenNavDrawer) {
      this.$root.$off('openNavDrawer', this._onOpenNavDrawer)
    }
    if (this._onPopState) {
      window.removeEventListener('popstate', this._onPopState)
    }
  },
  methods: {
    closeDrawer () {
      this.drawerShown = false
    }
  }
}
</script>

<style lang='scss'>
.nav-mobile-drawer-host {
  padding-top: 0;
}
</style>
