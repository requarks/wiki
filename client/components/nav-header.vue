<template lang='pug'>
  v-toolbar(color='black', dark, app, clipped-left, fixed, flat)
    v-toolbar-side-icon(@click.native='')
      v-icon view_module
    v-toolbar-title
      span.subheading Wiki.js
    v-spacer
    transition(name='navHeaderSearch')
      v-text-field(
        ref='searchField',
        v-if='searchIsShown',
        v-model='search',
        clearable,
        color='blue',
        label='Search...',
        single-line,
        hide-details,
        append-icon='search',
        :append-icon-cb='searchEnter',
        :loading='searchIsLoading',
        @keyup.enter='searchEnter',
        @keyup.esc='searchToggle'
      )
        v-progress-linear(
          indeterminate,
          slot='progress',
          height='2',
          color='blue'
        )
    v-spacer
    v-progress-circular.mr-3(indeterminate, color='blue', v-show='$apollo.loading')
    transition(name='navHeaderSearch')
      v-btn(icon, @click='searchToggle', v-if='!searchIsShown')
        v-icon(color='grey') search
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
export default {
  data() {
    return {
      searchIsLoading: false,
      searchIsShown: false,
      search: ''
    }
  },
  methods: {
    searchToggle() {
      this.searchIsLoading = false
      this.searchIsShown = !this.searchIsShown
      if (this.searchIsShown) {
        this.$nextTick(() => {
          this.$refs.searchField.focus()
        })
      }
    },
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
    transform: translateY(-25px);
  }
}
</style>
