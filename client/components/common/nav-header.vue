<template lang='pug'>
  v-app-bar.nav-header(color='black', dark, app, :clipped-left='!$vuetify.rtl', :clipped-right='$vuetify.rtl', fixed, flat, :extended='searchIsShown && $vuetify.breakpoint.smAndDown')
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
        prepend-inner-icon='mdi-magnify'
        :loading='searchIsLoading'
        @keyup.enter='searchEnter'
      )
    v-layout(row)
      v-flex(xs6, md4)
        v-toolbar.nav-header-inner.pl-3(color='black', dark, flat)
          v-menu(open-on-hover, offset-y, bottom, left, min-width='250', transition='slide-y-transition')
            template(v-slot:activator='{ on }')
              v-app-bar-nav-icon.btn-animate-app(v-on='on', :class='$vuetify.rtl ? `mx-0` : ``')
                v-icon mdi-menu-open
            v-list(nav, :light='!$vuetify.theme.dark', :dark='$vuetify.theme.dark', :class='$vuetify.theme.dark ? `grey darken-4` : ``')
              v-list-item.pl-4(href='/')
                v-list-item-avatar(size='24'): v-icon(color='blue') mdi-home
                v-list-item-title.body-2 {{$t('common:header.home')}}
              v-list-item.pl-4(@click='pageNew', v-if='isAuthenticated')
                v-list-item-avatar(size='24'): v-icon(color='green') mdi-file-document-box-plus-outline
                v-list-item-title.body-2 {{$t('common:header.newPage')}}
              template(v-if='path && path.length')
                v-divider.my-0
                .overline.pa-4.grey--text {{$t('common:header.currentPage')}}
                v-list-item.pl-4(@click='pageView', v-if='mode !== `view`')
                  v-list-item-avatar(size='24'): v-icon(color='indigo') mdi-file-document-box-outline
                  v-list-item-title.body-2 {{$t('common:header.view')}}
                v-list-item.pl-4(@click='pageEdit', v-if='mode !== `edit` && isAuthenticated')
                  v-list-item-avatar(size='24'): v-icon(color='indigo') mdi-file-document-edit-outline
                  v-list-item-title.body-2 {{$t('common:header.edit')}}
                v-list-item.pl-4(@click='pageHistory', v-if='mode !== `history`')
                  v-list-item-avatar(size='24'): v-icon(color='grey lighten-2') mdi-history
                  v-list-item-title.body-2.grey--text.text--ligten-2 {{$t('common:header.history')}}
                v-list-item.pl-4(@click='pageSource', v-if='mode !== `source`')
                  v-list-item-avatar(size='24'): v-icon(color='indigo') mdi-code-tags
                  v-list-item-title.body-2 {{$t('common:header.viewSource')}}
                v-list-item.pl-4(@click='pageMove', v-if='isAuthenticated')
                  v-list-item-avatar(size='24'): v-icon(color='grey lighten-2') mdi-content-save-move-outline
                  v-list-item-title.body-2.grey--text.text--ligten-2 {{$t('common:header.move')}}
                v-list-item.pl-4(@click='pageDelete', v-if='isAuthenticated')
                  v-list-item-avatar(size='24'): v-icon(color='red darken-2') mdi-trash-can-outline
                  v-list-item-title.body-2 {{$t('common:header.delete')}}
              v-divider.my-0
              .overline.pa-4.grey--text {{$t('common:header.assets')}}
              v-list-item.pl-4(@click='assets')
                v-list-item-avatar(size='24'): v-icon(color='grey lighten-2') mdi-folder-multiple-image
                v-list-item-title.body-2.grey--text.text--ligten-2 {{$t('common:header.imagesFiles')}}
          v-toolbar-title(:class='{ "mx-2": $vuetify.breakpoint.mdAndUp, "mx-0": $vuetify.breakpoint.smAndDown }')
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
                :label='$t(`common:header.search`)',
                single-line,
                solo
                flat
                hide-details,
                prepend-inner-icon='mdi-magnify',
                :loading='searchIsLoading',
                @keyup.enter='searchEnter'
                @keyup.esc='searchClose'
                @focus='searchFocus'
                @blur='searchBlur'
                @keyup.down='searchMove(`down`)'
                @keyup.up='searchMove(`up`)'
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
              template(v-slot:activator='{ on }')
                v-btn.nav-header-search-adv(icon, color='grey darken-2', v-on='on')
                  v-icon(color='white') mdi-chevron-down
              v-card.radius-0(dark)
                v-toolbar(flat, color='grey darken-4', dense)
                  v-icon.mr-2 mdi-feature-search-outline
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
                  v-container.pa-0(grid-list-md)
                    v-layout(row)
                      v-flex(xs6)
                        v-btn(depressed, color='grey darken-3', block)
                          v-icon(left) mdi-chevron-right
                          span Save as defaults
                      v-flex(xs6)
                        v-btn(depressed, color='grey darken-3', block)
                          v-icon(left) mdi-cached
                          span Reset
      v-flex(xs6, md4)
        v-toolbar.nav-header-inner.pr-4(color='black', dark, flat)
          v-spacer
          .navHeaderLoading.mr-3
            v-progress-circular(indeterminate, color='blue', :size='22', :width='2' v-show='isLoading')
          slot(name='actions')
          v-btn(
            v-if='!hideSearch && $vuetify.breakpoint.smAndDown'
            @click='searchToggle'
            icon
            )
            v-icon(color='grey') mdi-magnify
          v-menu(offset-y, left, transition='slide-y-transition', v-if='mode === `view` && locales.length > 0')
            template(v-slot:activator='{ on: menu }')
              v-tooltip(bottom)
                template(v-slot:activator='{ on: tooltip }')
                  v-btn(icon, v-on='{ ...menu, ...tooltip }', :class='$vuetify.rtl ? `ml-3` : ``')
                    v-icon(color='grey') mdi-web
                span {{$t('common:header.language')}}
            v-list.py-0
              template(v-for='(lc, idx) of locales')
                v-list-item(@click='changeLocale(lc)')
                  v-list-item-action: v-chip(:color='lc.code === locale ? `blue` : `grey`', small, label, dark) {{lc.code.toUpperCase()}}
                  v-list-item-title {{lc.name}}
                v-divider.my-0(v-if='idx < locales.length - 1')
          v-tooltip(bottom, v-if='isAuthenticated && isAdmin')
            template(v-slot:activator='{ on }')
              v-btn.btn-animate-rotate(icon, href='/a', v-on='on', :class='$vuetify.rtl ? `ml-3` : ``')
                v-icon(color='grey') mdi-settings
            span {{$t('common:header.admin')}}
          v-menu(v-if='isAuthenticated', offset-y, min-width='300', left, transition='slide-y-transition')
            template(v-slot:activator='{ on: menu }')
              v-tooltip(bottom)
                template(v-slot:activator='{ on: tooltip }')
                  v-btn(icon, v-on='{ ...menu, ...tooltip }', :class='$vuetify.rtl ? `ml-0` : ``')
                    v-icon(v-if='picture.kind === `initials`', color='grey') mdi-account-circle
                    v-avatar(v-else-if='picture.kind === `image`', :size='34')
                      v-img(:src='picture.url')
                span {{$t('common:header.account')}}
            v-list.py-0
              v-list-item.py-3.grey(:class='$vuetify.theme.dark ? `darken-4-l5` : `lighten-5`')
                v-list-item-avatar
                  v-avatar.blue(v-if='picture.kind === `initials`', :size='40')
                    span.white--text.subheading {{picture.initials}}
                  v-avatar(v-else-if='picture.kind === `image`', :size='40')
                    v-img(:src='picture.url')
                v-list-item-content
                  v-list-item-title {{name}}
                  v-list-item-subtitle {{email}}
              v-divider.my-0
              v-list-item(href='/w', disabled)
                v-list-item-action: v-icon(color='blue') mdi-view-compact-outline
                v-list-item-title {{$t('common:header.myWiki')}}
              v-divider.my-0
              v-list-item(href='/p', disabled)
                v-list-item-action: v-icon(color='blue') mdi-face-profile
                v-list-item-title {{$t('common:header.profile')}}
              v-divider.my-0
              v-list-item(@click='logout')
                v-list-item-action: v-icon(color='red') mdi-logout
                v-list-item-title {{$t('common:header.logout')}}

          v-tooltip(v-else, left)
            template(v-slot:activator='{ on }')
              v-btn(icon, v-on='on', color='grey darken-3', href='/login')
                v-icon(color='grey') mdi-account-circle
            span {{$t('common:header.login')}}

    page-selector(mode='create', v-model='newPageModal', :open-handler='pageNewCreate')
    page-delete(v-model='deletePageModal', v-if='path && path.length')
</template>

<script>
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'
import Cookies from 'js-cookie'

/* global siteLangs */

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
      deletePageModal: false,
      locales: siteLangs
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
    locale: get('page/locale'),
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
      window.location.assign(`/e/${locale}/${path}`)
    },
    pageView () {
      window.location.assign(`/${this.locale}/${this.path}`)
    },
    pageEdit () {
      window.location.assign(`/e/${this.locale}/${this.path}`)
    },
    pageHistory () {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'ferry'
      })
      // window.location.assign(`/h/${this.locale}/${this.path}`)
    },
    pageSource () {
      window.location.assign(`/s/${this.locale}/${this.path}`)
    },
    pageMove () {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'ferry'
      })
    },
    pageDelete () {
      this.deletePageModal = true
    },
    assets () {
      // window.location.assign(`/f`)
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'ferry'
      })
    },
    async changeLocale(locale) {
      await this.$i18n.i18next.changeLanguage(locale.code)
      switch (this.mode) {
        case 'view':
        case 'history':
          window.location.assign(`/${locale.code}/${this.path}`)
          break
      }
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
  //z-index: 1000;

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

    @at-root .v-application--is-rtl & {
      right: initial;
      left: 12px;
    }

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
