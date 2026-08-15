<template lang='pug'>
  nav-sidebar(
    v-if='navMode !== `NONE`'
    :color='sidebarColor'
    :dark='sidebarDark'
    :items='sidebarItems'
    :nav-mode='navMode'
    @navigate='$emit(`navigate`)'
    )
</template>

<script>
import { get } from 'vuex-pathify'

import NavSidebar from '../../themes/default/components/nav-sidebar.vue'

export default {
  components: {
    NavSidebar
  },
  computed: {
    navMode: get('page/navMode'),
    sidebarItems: get('page/sidebar'),
    sidebarColor () {
      return this.$vuetify.theme.dark ? 'blue darken-4' : 'primary'
    },
    sidebarDark () {
      return true
    }
  }
}
</script>
