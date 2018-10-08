<template lang='pug'>
  v-toolbar.nav-header(color='black', dark, app, clipped-left, fixed, flat, :extended='searchIsShown && $vuetify.breakpoint.smAndDown')
    v-toolbar(color='deep-purple', flat, slot='extension', v-if='searchIsShown && $vuetify.breakpoint.smAndDown')
      v-text-field(
        ref='searchFieldMobile',
        v-model='search',
        clearable,
        background-color='deep-purple'
        color='white',
        label='Search...',
        single-line,
        solo
        flat
        hide-details,
        prepend-inner-icon='search',
        :loading='searchIsLoading',
        @keyup.enter='searchEnter'
      )
    v-menu(open-on-hover, offset-y, bottom, left, min-width='250')
      v-toolbar-side-icon(slot='activator')
        v-icon view_module
      v-list(dense, :light='!$vuetify.dark').py-0
        v-list-tile(avatar, href='/')
          v-list-tile-avatar: v-icon(color='blue') home
          v-list-tile-content Home
        v-list-tile(avatar, @click='pageNew')
          v-list-tile-avatar: v-icon(color='green') add_box
          v-list-tile-content New Page
        v-divider.my-0
        v-subheader Current Page
        v-list-tile(avatar, @click='pageEdit')
          v-list-tile-avatar: v-icon(color='indigo') edit
          v-list-tile-content Edit
        v-list-tile(avatar, @click='pageHistory')
          v-list-tile-avatar: v-icon(color='indigo') history
          v-list-tile-content History
        v-list-tile(avatar, @click='pageSource')
          v-list-tile-avatar: v-icon(color='indigo') code
          v-list-tile-content View Source
        v-list-tile(avatar, @click='pageMove')
          v-list-tile-avatar: v-icon(color='indigo') forward
          v-list-tile-content Move / Rename
        v-list-tile(avatar, @click='pageDelete')
          v-list-tile-avatar: v-icon(color='red darken-2') delete
          v-list-tile-content Delete
        v-divider.my-0
        v-subheader Assets
        v-list-tile(avatar, @click='')
          v-list-tile-avatar: v-icon(color='blue-grey') burst_mode
          v-list-tile-content Images &amp; Files
    v-toolbar-title(:class='{ "ml-2": $vuetify.breakpoint.mdAndUp, "ml-0": $vuetify.breakpoint.smAndDown }')
      span.subheading {{title}}
    v-spacer(v-if='searchIsShown && $vuetify.breakpoint.mdAndUp')
    transition(name='navHeaderSearch')
      v-text-field(
        ref='searchField',
        v-if='searchIsShown && $vuetify.breakpoint.mdAndUp',
        v-model='search',
        clearable,
        color='white',
        label='Search...',
        single-line,
        solo
        flat
        hide-details,
        prepend-inner-icon='search',
        :loading='searchIsLoading',
        @keyup.enter='searchEnter'
      )
        v-progress-linear(
          indeterminate,
          slot='progress',
          height='2',
          color='blue'
        )
    v-spacer
    .navHeaderLoading.mr-3
      v-progress-circular(indeterminate, color='blue', :size='22', :width='2' v-show='isLoading')
    slot(name='actions')
    v-btn(
      v-if='!hideSearch && $vuetify.breakpoint.smAndDown'
      @click='searchToggle'
      icon
      )
      v-icon(color='grey') search
    v-tooltip(bottom)
      v-btn(icon, href='/a', slot='activator')
        v-icon(color='grey') settings
      span Admin
    v-menu(offset-y, min-width='300')
      v-tooltip(bottom, slot='activator')
        v-btn(icon, slot='activator')
          v-icon(color='grey') account_circle
        span Account
      v-list.py-0(:light='!$vuetify.dark')
        v-list-tile.py-3(avatar)
          v-list-tile-avatar
            v-avatar.red(:size='40'): span.white--text.subheading JD
          v-list-tile-content
            v-list-tile-title John Doe
            v-list-tile-sub-title john.doe@example.com
        v-divider.my-0
        v-list-tile(href='/p')
          v-list-tile-action: v-icon(color='red') person
          v-list-tile-title Profile
        v-list-tile(@click='logout')
          v-list-tile-action: v-icon(color='red') exit_to_app
          v-list-tile-title Logout
</template>

<script>
import { get } from 'vuex-pathify'
import _ from 'lodash'
import Cookies from 'js-cookie'

export default {
  props: {
    dense: {
      type: Boolean,
      default: false
    },
    hideSearch: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      menuIsShown: true,
      searchIsLoading: false,
      searchIsShown: true,
      search: ''
    }
  },
  computed: {
    isLoading: get('isLoading'),
    title: get('site/title')
  },
  created() {
    if (this.hideSearch || this.dense || this.$vuetify.breakpoint.smAndDown) {
      this.searchIsShown = false
    }
  },
  methods: {
    searchToggle() {
      this.searchIsShown = !this.searchIsShown
      if (this.searchIsShown) {
        _.delay(() => {
          this.$refs.searchFieldMobile.focus()
        }, 200)
      }
    },
    searchEnter() {
      this.searchIsLoading = true
    },
    pageNew () {

    },
    pageEdit () {

    },
    pageHistory () {

    },
    pageSource () {

    },
    pageMove () {

    },
    pageDelete () {

    },
    logout () {
      Cookies.remove('jwt')
      window.location.assign('/')
    }
  }
}
</script>

<style lang='scss'>

.nav-header {
  .v-toolbar__extension {
    padding: 0;

    .v-toolbar__content {
      padding: 0;
    }
    .v-text-field .v-input__prepend-inner {
      padding: 0 14px 0 5px;
      padding-right: 14px;
    }
  }
}

.navHeaderSearch {
  &-enter-active, &-leave-active {
    transition: opacity .25s ease, transform .25s ease;
    opacity: 1;
  }
  &-enter-active {
    transition-delay: .25s;
  }
  &-enter, &-leave-to {
    opacity: 0;
    transform: scale(.7, .7);
  }
}
.navHeaderLoading { // To avoid search bar jumping
  width: 22px;
}
</style>
