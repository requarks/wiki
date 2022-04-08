<template lang='pug'>
q-layout(view='hHh Lpr lff')
  header-nav
  q-drawer.bg-sidebar(
    v-model='showSideNav'
    show-if-above
    :width='255'
    )
    .sidebar-actions.flex.items-stretch
      q-btn.q-px-sm.col(
        flat
        dense
        icon='las la-globe'
        color='blue-7'
        text-color='blue-2'
        label='EN'
        aria-label='EN'
        size='sm'
        )
      q-separator(vertical)
      q-btn.q-px-sm.col(
        flat
        dense
        icon='las la-sitemap'
        color='blue-7'
        text-color='blue-2'
        label='Browse'
        aria-label='Browse'
        size='sm'
        )
    q-scroll-area.sidebar-nav(
      :thumb-style='thumbStyle'
      :bar-style='barStyle'
      )
      q-list(
        clickable
        dense
        dark
        )
        q-item-label.text-blue-2.text-caption(header) Getting Started
        q-item(to='/install')
          q-item-section(side)
            q-icon(name='las la-dog', color='white')
          q-item-section Requirements
        q-item(to='/install')
          q-item-section(side)
            q-icon(name='las la-cat', color='white')
          q-item-section Installation
        q-separator.q-my-sm(dark)
        q-item(to='/install')
          q-item-section(side)
            q-icon(name='las la-cat', color='white')
          q-item-section Installation
    q-bar.bg-blue-9.text-white(dense)
      q-btn.col(
        icon='las la-dharmachakra'
        label='History'
        flat
      )
      q-separator(vertical)
      q-btn.col(
        icon='las la-bookmark'
        label='Bookmarks'
        flat
      )
  q-page-container
    router-view
    q-page-scroller(
      position='bottom-right'
      :scroll-offset='150'
      :offset='[15, 15]'
      )
      q-btn(
        icon='las la-arrow-up'
        color='primary'
        round
        size='md'
      )
  q-footer
    q-bar.justify-center(dense)
      span(style='font-size: 11px;') &copy; Cyberdyne Systems Corp. 2020 | Powered by #[strong Wiki.js]
</template>

<script>
import { get, sync } from 'vuex-pathify'
import { setCssVar } from 'quasar'
import HeaderNav from '../components/HeaderNav.vue'

export default {
  name: 'MainLayout',
  components: {
    HeaderNav
  },
  data () {
    return {
      leftDrawerOpen: true,
      search: '',
      thumbStyle: {
        right: '2px',
        borderRadius: '5px',
        backgroundColor: '#FFF',
        width: '5px',
        opacity: 0.5
      },
      barStyle: {
        backgroundColor: '#000',
        width: '9px',
        opacity: 0.1
      }
    }
  },
  computed: {
    showSideNav: sync('site/showSideNav', false),
    isSyncing: get('isLoading', false)
  },
  created () {
    setCssVar('primary', this.$store.get('site/theme@colorPrimary'))
    setCssVar('secondary', this.$store.get('site/theme@colorSecondary'))
    setCssVar('accent', this.$store.get('site/theme@colorAccent'))
    setCssVar('header', this.$store.get('site/theme@colorHeader'))
    setCssVar('sidebar', this.$store.get('site/theme@colorSidebar'))
  }
}
</script>

<style lang="scss">
.sidebar-actions {
  background: linear-gradient(to bottom, rgba(255,255,255,.1) 0%, rgba(0,0,0, .05) 100%);
  border-bottom: 1px solid rgba(0,0,0,.2);
  height: 38px;
}
.sidebar-nav {
  border-top: 1px solid rgba(255,255,255,.15);
  height: calc(100% - 38px - 24px);
}

body.body--dark {
  background-color: $dark-6;
}

.q-footer {
  .q-bar {
    @at-root .body--light & {
      background-color: $grey-3;
      color: $grey-7;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      color: rgba(255,255,255,.3);
    }
  }
}

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
