<template lang="pug">
q-header.bg-header.text-white.site-header(
  height-hint='64'
  )
  .row.no-wrap
    q-toolbar(
      style='height: 64px;'
      dark
      )
      q-btn(
        dense
        flat
        to='/'
        )
        q-avatar(
          size='34px'
          square
          )
          img(src='/_assets/logo-wikijs.svg')
      q-toolbar-title.text-h6.font-poppins {{siteTitle}}
    q-toolbar.gt-sm(
      style='height: 64px;'
      dark
      )
      q-input(
        dark
        v-model='search'
        standout='bg-white text-dark'
        dense
        rounded
        ref='searchField'
        style='width: 100%;'
        label='Search...'
        )
        template(v-slot:prepend)
          q-icon(name='las la-search')
        template(v-slot:append)
          q-icon.cursor-pointer(
            name='las la-times'
            @click='search=``'
            v-if='search.length > 0'
            :color='$q.dark.isActive ? `blue` : `grey-4`'
            )
      q-btn.q-ml-md(
        flat
        round
        dense
        icon='las la-tags'
        color='grey'
        to='/t'
        )
    q-toolbar(
      style='height: 64px;'
      dark
      )
      q-space
      transition(name='syncing')
        q-spinner-rings.q-mr-sm(
          v-show='isSyncing'
          color='orange'
          size='34px'
        )
      q-btn.q-ml-md(
        flat
        round
        dense
        icon='las la-plus-circle'
        color='blue-4'
        aria-label='Create New Page'
        )
        q-tooltip Create New Page
        new-menu
      q-btn.q-ml-md(
        flat
        round
        dense
        icon='las la-tools'
        color='secondary'
        to='/_admin'
        aria-label='Administration'
        )
        q-tooltip Administration
      account-menu
</template>

<script>
import { get } from 'vuex-pathify'
import AccountMenu from './AccountMenu.vue'
import NewMenu from './PageNewMenu.vue'

export default {
  components: {
    AccountMenu,
    NewMenu
  },
  data () {
    return {
      search: ''
    }
  },
  computed: {
    isSyncing: get('isLoading', false),
    siteTitle: get('site/title', false)
  }
}
</script>

<style lang="scss">
.syncing-enter-active {
  animation: syncing-anim .1s;
}
.syncing-leave-active {
  animation: syncing-anim 1s reverse;
}
@keyframes syncing-anim {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>
