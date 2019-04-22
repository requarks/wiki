<template lang='pug'>
  v-toolbar.nav-header(color='black', dark, app, clipped-left, fixed, flat, :extended='searchIsShown && $vuetify.breakpoint.smAndDown')
    v-toolbar(color='deep-purple', flat, slot='extension', v-if='searchIsShown && $vuetify.breakpoint.smAndDown')
      v-text-field(
        ref='searchFieldMobile'
        v-model='search'
        clearable
        background-color='deep-purple'
        color='white'
        label='Search...'
        single-line
        solo
        flat
        hide-details
        prepend-inner-icon='search'
        :loading='searchIsLoading'
        @keyup.enter='searchEnter'
      )
    v-layout(row)
      v-flex(xs6, :md4='searchIsShown', :md6='!searchIsShown')
        v-toolbar.nav-header-inner(color='black', dark, flat)
          v-menu(open-on-hover, offset-y, bottom, left, min-width='250')
            v-toolbar-side-icon.btn-animate-app(slot='activator')
              v-icon view_module
            v-list(dense, :light='!$vuetify.dark', :dark='$vuetify.dark', :class='$vuetify.dark ? `grey darken-4` : ``').py-0
              v-list-tile(avatar, href='/')
                v-list-tile-avatar: v-icon(color='blue') home
                v-list-tile-content Home
              v-list-tile(avatar, @click='pageNew')
                v-list-tile-avatar: v-icon(color='green') add_box
                v-list-tile-content New Page
              template(v-if='path && path.length')
                v-divider.my-0
                v-subheader Current Page
                v-list-tile(avatar, @click='pageView', v-if='mode !== `view`')
                  v-list-tile-avatar: v-icon(color='indigo') subject
                  v-list-tile-content View
                v-list-tile(avatar, @click='pageEdit', v-if='mode !== `edit`')
                  v-list-tile-avatar: v-icon(color='indigo') edit
                  v-list-tile-content Edit
                v-list-tile(avatar, @click='pageHistory', v-if='mode !== `history`')
                  v-list-tile-avatar: v-icon(color='indigo') history
                  v-list-tile-content History
                v-list-tile(avatar, @click='pageSource', v-if='mode !== `source`')
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
              v-list-tile(avatar, @click='assets')
                v-list-tile-avatar: v-icon(color='blue-grey') burst_mode
                v-list-tile-content Images &amp; Files
          v-toolbar-title(:class='{ "ml-2": $vuetify.breakpoint.mdAndUp, "ml-0": $vuetify.breakpoint.smAndDown }')
            span.subheading {{title}}
      v-flex(md4, v-if='$vuetify.breakpoint.mdAndUp')
        v-toolbar.nav-header-inner(color='black', dark, flat)
          slot(name='mid')
            transition(name='navHeaderSearch', v-if='searchIsShown')
              v-text-field(
                ref='searchField',
                v-if='searchIsShown && $vuetify.breakpoint.mdAndUp',
                v-model='search',
                color='white',
                label='Search...',
                single-line,
                solo
                flat
                hide-details,
                prepend-inner-icon='search',
                :loading='searchIsLoading',
                @keyup.enter='searchEnter'
                @keyup.esc='searchClose'
                @focus='searchFocus'
                @blur='searchBlur'
                @keyup.down='searchMove(`down`)'
                @keyup.up='searchMove(`up`)'
              )
                v-progress-linear(
                  indeterminate,
                  slot='progress',
                  height='2',
                  color='blue'
                )
            v-menu(
              v-model='searchAdvMenuShown'
              left
              offset-y
              min-width='450'
              :close-on-content-click='false'
              nudge-bottom='7'
              nudge-right='5'
              v-if='searchIsShown'
              )
              v-btn.nav-header-search-adv(icon, outline, color='grey darken-2', slot='activator')
                v-icon(color='white') expand_more
              v-card.radius-0(dark)
                v-toolbar(flat, color='grey darken-4', dense)
                  v-icon.mr-2 search
                  v-subheader.pl-0 Advanced Search
                  v-spacer
                  v-chip(label, small, color='primary') Coming soon
                v-card-text.pa-4
                  v-checkbox.mt-0(
                    label='Restrict to current language'
                    color='white'
                    v-model='searchRestrictLocale'
                    hide-details
                  )
                  v-checkbox(
                    label='Search below current path only'
                    color='white'
                    v-model='searchRestrictPath'
                    hide-details
                  )
                v-divider
                v-card-actions.grey.darken-3-d4
                  v-btn(depressed, color='grey darken-3', block)
                    v-icon(left) chevron_right
                    span Save as defaults
                  v-btn(depressed, color='grey darken-3', block)
                    v-icon(left) cached
                    span Reset
      v-flex(xs6, :md4='searchIsShown', :md6='!searchIsShown')
        v-toolbar.nav-header-inner(color='black', dark, flat)
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
          v-tooltip(bottom, v-if='isAuthenticated && isAdmin')
            v-btn.btn-animate-rotate(icon, href='/a', slot='activator')
              v-icon(color='grey') settings
            span Admin
          v-menu(v-if='isAuthenticated', offset-y, min-width='300', left)
            v-tooltip(bottom, slot='activator')
              v-btn(icon, slot='activator', outline, color='blue')
                v-icon(v-if='picture.kind === `initials`', color='grey') account_circle
                v-avatar(v-else-if='picture.kind === `image`', :size='29')
                  v-img(:src='picture.url')
              span Account
            v-list.py-0
              v-list-tile.py-3.grey(avatar, :class='$vuetify.dark ? `darken-4-l5` : `lighten-5`')
                v-list-tile-avatar
                  v-avatar.blue(v-if='picture.kind === `initials`', :size='40')
                    span.white--text.subheading {{picture.initials}}
                  v-avatar(v-else-if='picture.kind === `image`', :size='40')
                    v-img(:src='picture.url')
                v-list-tile-content
                  v-list-tile-title {{name}}
                  v-list-tile-sub-title {{email}}
              v-divider.my-0
              v-list-tile(href='/w')
                v-list-tile-action: v-icon(color='blue') web
                v-list-tile-title My Wiki
              v-divider.my-0
              v-list-tile(href='/p')
                v-list-tile-action: v-icon(color='blue') person
                v-list-tile-title Profile
              v-divider.my-0
              v-list-tile(@click='logout')
                v-list-tile-action: v-icon(color='red') exit_to_app
                v-list-tile-title Logout

          v-tooltip(v-else, left)
            v-btn(icon, slot='activator', outline, color='grey darken-3', href='/login')
              v-icon(color='grey') account_circle
            span Login

    page-selector(mode='create', v-model='newPageModal', :open-handler='pageNewCreate')
    page-delete(v-model='deletePageModal', v-if='path && path.length')
</template>

<script>
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'
import Cookies from 'js-cookie'

export default {
  components: {
    PageDelete: () => import('./page-delete.vue')
  },
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
      searchIsShown: true,
      searchAdvMenuShown: false,
      newPageModal: false,
      deletePageModal: false
    }
  },
  computed: {
    search: sync('site/search'),
    searchIsFocused: sync('site/searchIsFocused'),
    searchIsLoading: sync('site/searchIsLoading'),
    searchRestrictLocale: sync('site/searchRestrictLocale'),
    searchRestrictPath: sync('site/searchRestrictPath'),
    isLoading: get('isLoading'),
    title: get('site/title'),
    path: get('page/path'),
    mode: get('page/mode'),
    name: get('user/name'),
    email: get('user/email'),
    pictureUrl: get('user/pictureUrl'),
    isAuthenticated: get('user/authenticated'),
    permissions: get('user/permissions'),
    picture() {
      if (this.pictureUrl && this.pictureUrl.length > 1) {
        return {
          kind: 'image',
          url: this.pictureUrl
        }
      } else {
        const nameParts = this.name.toUpperCase().split(' ')
        let initials = _.head(nameParts).charAt(0)
        if (nameParts.length > 1) {
          initials += _.last(nameParts).charAt(0)
        }
        return {
          kind: 'initials',
          initials
        }
      }
    },
    isAdmin() {
      return _.includes(this.permissions, 'manage:system')
    }
  },
  created() {
    if (this.hideSearch || this.dense || this.$vuetify.breakpoint.smAndDown) {
      this.searchIsShown = false
    }
  },
  methods: {
    searchFocus() {
      this.searchIsFocused = true
    },
    searchBlur() {
      this.searchIsFocused = false
    },
    searchClose() {
      this.search = ''
      this.searchBlur()
    },
    searchToggle() {
      this.searchIsShown = !this.searchIsShown
      if (this.searchIsShown) {
        _.delay(() => {
          this.$refs.searchFieldMobile.focus()
        }, 200)
      }
    },
    searchEnter() {
      this.$root.$emit('searchEnter', true)
    },
    searchMove(dir) {
      this.$root.$emit('searchMove', dir)
    },
    pageNew () {
      this.newPageModal = true
    },
    pageNewCreate ({ path, locale }) {
      window.location.assign(`/e/${path}`)
    },
    pageView () {
      window.location.assign(`/${this.path}`)
    },
    pageEdit () {
      window.location.assign(`/e/${this.path}`)
    },
    pageHistory () {
      window.location.assign(`/h/${this.path}`)
    },
    pageSource () {
      window.location.assign(`/s/${this.path}`)
    },
    pageMove () {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    },
    pageDelete () {
      this.deletePageModal = true
    },
    assets () {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
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

  &-inner {
    .v-toolbar__content {
      padding: 0;
    }
  }

  &-search-adv {
    position: absolute;
    top: 7px;
    right: 12px;
    border-radius: 4px !important;

    &::before {
      border-radius: 4px !important;
    }

    &:hover, &:focus {
      position: absolute !important;

      &::before {
        border-radius: 4px;
      }
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
