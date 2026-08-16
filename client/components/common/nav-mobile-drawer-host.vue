<template lang='pug'>
  nav-drawer-shell(
    v-if='$vuetify.breakpoint.smAndDown && drawerCategory'
    v-model='drawerShown'
    temporary
    :category='drawerCategory'
    :width='drawerWidth'
    :mobile-breakpoint='600'
    @navigate='closeDrawer'
    )
    component(v-if='contentComponent', :is='contentComponent', @navigate='closeDrawer')
</template>

<script>
import { get } from 'vuex-pathify'

import { getNavDrawerCategory } from './nav-drawer-category'
import NavDrawerShell from './nav-drawer-shell.vue'
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
    NavDrawerShell
  },
  data () {
    return {
      drawerShown: false,
      drawerCategory: getNavDrawerCategory()
    }
  },
  computed: {
    printView: get('site/printView'),
    drawerWidth () {
      return Math.min(Math.round(window.innerWidth * 0.88), 320)
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
