<template lang='pug'>
  v-toolbar(color='black', dark, app, clipped-left, fixed, flat, :dense='dense')
    v-menu(open-on-hover, offset-y, bottom, left, nudge-top='-18', min-width='250')
      v-toolbar-side-icon(slot='activator')
        v-icon view_module
      v-list(dense).py-0
        v-list-tile(avatar, href='/')
          v-list-tile-avatar: v-icon(color='blue') home
          v-list-tile-content Home
        v-list-tile(avatar, @click='')
          v-list-tile-avatar: v-icon(color='green') add_box
          v-list-tile-content New Page
        v-divider.my-0
        v-subheader Current Page
        v-list-tile(avatar, @click='')
          v-list-tile-avatar: v-icon(color='indigo') edit
          v-list-tile-content Edit
        v-list-tile(avatar, @click='')
          v-list-tile-avatar: v-icon(color='indigo') history
          v-list-tile-content History
        v-list-tile(avatar, @click='')
          v-list-tile-avatar: v-icon(color='indigo') code
          v-list-tile-content View Source
        v-list-tile(avatar, @click='')
          v-list-tile-avatar: v-icon(color='indigo') forward
          v-list-tile-content Move / Rename
        v-list-tile(avatar, @click='')
          v-list-tile-avatar: v-icon(color='red darken-2') delete
          v-list-tile-content Delete
        v-divider.my-0
        v-subheader Assets
        v-list-tile(avatar, @click='')
          v-list-tile-avatar: v-icon(color='blue-grey') burst_mode
          v-list-tile-content Images &amp; Files
    v-toolbar-title
      span.subheading {{title}}
    v-spacer
    transition(name='navHeaderSearch')
      v-text-field(
        ref='searchField',
        v-if='searchIsShown',
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
    v-btn(icon, href='/a')
      v-icon(color='grey') settings
    v-menu(offset-y, min-width='300')
      v-btn(icon, slot='activator')
        v-icon(color='grey') account_circle
      v-list.py-0
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
        v-list-tile(href='/logout')
          v-list-tile-action: v-icon(color='red') exit_to_app
          v-list-tile-title Logout
</template>

<script>
import { mapGetters } from 'vuex'

/* global siteConfig */

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
    ...mapGetters(['isLoading']),
    title() { return siteConfig.title }
  },
  created() {
    if (this.hideSearch || this.dense) {
      this.searchIsShown = false
    }
  },
  methods: {
    searchEnter() {
      this.searchIsLoading = true
    }
  }
}
</script>

<style lang='scss'>
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
