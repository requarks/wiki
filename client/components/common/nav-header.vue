<template lang='pug'>
  div
    v-app-bar.nav-header(:color='navBarColor', dark, app, :clipped-left='!$vuetify.rtl', :clipped-right='$vuetify.rtl', fixed, flat)
      //- Mobile editor: title + save/page/close (upstream keeps actions slot on small screens)
      v-toolbar.nav-header-mobile-editor(v-if='mobileViewport && isEditorHeader', :color='navBarColor', dark, flat)
        .nav-header-mobile-editor__mid
          slot(name='mid')
        .nav-header-mobile-editor__actions
          .navHeaderLoading.nav-header-mobile-editor__loading(v-show='isLoading')
            v-progress-circular(indeterminate, color='white', :size='18', :width='2')
          slot(name='actions')

      //- Mobile view: menu | search | chat
      v-toolbar.nav-header-mobile(v-else-if='mobileViewport', :color='navBarColor', dark, flat)
        v-btn.nav-header-mobile__menu(icon, @click='openMobileNav', :aria-label='$t(`common:sidebar.mainMenu`)')
          v-icon(color='white') mdi-menu
        v-text-field.nav-header-mobile__search(
          ref='searchFieldMobile'
          v-model='search'
          clearable
          background-color='white'
          :color='navBarColor'
          light
          :label='$t(`common:header.search`)'
          single-line
          solo
          flat
          rounded
          dense
          hide-details
          prepend-inner-icon='mdi-magnify'
          :loading='searchIsLoading'
          @keyup.enter='searchEnter'
          @keyup.esc='searchClose'
          @focus='searchFocus'
          @blur='searchBlur'
          @keyup.down='searchMove(`down`)'
          @keyup.up='searchMove(`up`)'
          autocomplete='off'
        )

        v-btn.nav-header-mobile__chat(v-if='showMobileChat', icon, @click='chatClick', :aria-label='$t(`common:comments.title`)')
          v-icon(color='white') mdi-message-text-outline

        .navHeaderLoading.nav-header-mobile__loading(v-show='isLoading')
          v-progress-circular(indeterminate, color='white', :size='18', :width='2')

      //- Desktop layout
      template(v-else)
        v-layout(row)
          v-flex(md4)
            v-toolbar.nav-header-inner(:color='navBarColor', dark, flat, :class='$vuetify.rtl ? `pr-3` : `pl-3`')
              v-avatar(tile, size='34', @click='goHome')
                v-img.org-logo(:src='logoUrl')
              v-toolbar-title.mx-3
                span.subheading {{title}}
          v-flex(md4)
            v-toolbar.nav-header-inner(:color='navBarColor', dark, flat)
              slot(name='mid')
                .nav-header-desktop__center
                  transition(name='navHeaderSearch', v-if='searchIsShown')
                    v-text-field.nav-header-desktop__search(
                      ref='searchField',
                      v-if='searchIsShown',
                      v-model='search',
                      background-color='white'
                      :color='navBarColor'
                      light
                      :label='$t(`common:header.search`)',
                      single-line,
                      solo
                      flat
                      rounded
                      dense
                      hide-details,
                      prepend-inner-icon='mdi-magnify',
                      :loading='searchIsLoading',
                      @keyup.enter='searchEnter'
                      @keyup.esc='searchClose'
                      @focus='searchFocus'
                      @blur='searchBlur'
                      @keyup.down='searchMove(`down`)'
                      @keyup.up='searchMove(`up`)'
                      autocomplete='off'
                    )
          v-flex(md4)
            v-toolbar.nav-header-inner.pr-4(:color='navBarColor', dark, flat)
              v-spacer
              .navHeaderLoading.mr-3
                v-progress-circular(indeterminate, color='white', :size='22', :width='2' v-show='isLoading')

              slot(name='actions')

              template(v-if='mode === `view` && locales.length > 0')
                v-menu(offset-y, bottom, transition='slide-y-transition', max-height='320px', min-width='210px', left)
                  template(v-slot:activator='{ on: menu, attrs }')
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on: tooltip }')
                        v-btn(
                          icon
                          v-bind='attrs'
                          v-on='{ ...menu, ...tooltip }'
                          :class='$vuetify.rtl ? `ml-3` : ``'
                          tile
                          height='64'
                          :aria-label='$t(`common:header.language`)'
                          )
                          v-icon(color='white') mdi-web
                      span {{$t('common:header.language')}}
                  v-list(nav)
                    template(v-for='(lc, idx) of locales')
                      v-list-item(@click='changeLocale(lc)')
                        v-list-item-action(style='min-width:auto;'): v-chip(:color='lc.code === locale ? `blue` : `grey`', small, label, dark) {{lc.code.toUpperCase()}}
                        v-list-item-title {{lc.name}}
                v-divider(vertical)

              //- PAGE ACTIONS

              template(v-if='hasAnyPagePermissions && path && mode !== `edit`')
                v-menu(offset-y, bottom, transition='slide-y-transition', left)
                  template(v-slot:activator='{ on: menu, attrs }')
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on: tooltip }')
                        v-btn(
                          icon
                          data-auth-required
                          v-bind='attrs'
                          v-on='{ ...menu, ...tooltip }'
                          :class='$vuetify.rtl ? `ml-3` : ``'
                          tile
                          height='64'
                          :aria-label='$t(`common:header.pageActions`)'
                          )
                          v-icon(color='white') mdi-file-document-edit-outline
                      span {{$t('common:header.pageActions')}}
                  v-list(nav, :light='!$vuetify.theme.dark', :dark='$vuetify.theme.dark', :class='$vuetify.theme.dark ? `grey darken-4` : ``')
                    .overline.pa-4.grey--text {{$t('common:header.currentPage')}}
                    v-list-item.pl-4(@click='pageView', v-if='mode !== `view`')
                      v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-file-document-outline
                      v-list-item-title.body-2 {{$t('common:header.view')}}
                    v-list-item.pl-4(@click='pageEdit', v-if='mode !== `edit` && hasWritePagesPermission')
                      v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-file-document-edit-outline
                      v-list-item-title.body-2 {{$t('common:header.edit')}}
                    v-list-item.pl-4(@click='pageHistory', v-if='mode !== `history` && hasReadHistoryPermission')
                      v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-history
                      v-list-item-content
                        v-list-item-title.body-2 {{$t('common:header.history')}}
                    v-list-item.pl-4(@click='pageSource', v-if='mode !== `source` && hasReadSourcePermission')
                      v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-code-tags
                      v-list-item-title.body-2 {{$t('common:header.viewSource')}}
                    v-list-item.pl-4(@click='pageConvert', v-if='hasWritePagesPermission')
                      v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-lightning-bolt
                      v-list-item-title.body-2 {{$t('common:header.convert')}}
                    v-list-item.pl-4(@click='pageDuplicate', v-if='hasWritePagesPermission')
                      v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-content-duplicate
                      v-list-item-title.body-2 {{$t('common:header.duplicate')}}
                    v-list-item.pl-4(@click='pageMove', v-if='hasManagePagesPermission')
                      v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-content-save-move-outline
                      v-list-item-content
                        v-list-item-title.body-2 {{$t('common:header.move')}}
                    v-list-item.pl-4(@click='pageDelete', v-if='hasDeletePagesPermission')
                      v-list-item-avatar(size='24', tile): v-icon(color='red darken-2') mdi-trash-can-outline
                      v-list-item-title.body-2 {{$t('common:header.delete')}}
                v-divider(vertical)

              //- NEW PAGE

              template(v-if='hasNewPagePermission && path && mode !== `edit`')
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn(icon, tile, height='64', data-auth-required, v-on='on', @click='pageNew', :aria-label='$t(`common:header.newPage`)')
                      v-icon(color='white') mdi-text-box-plus-outline
                  span {{$t('common:header.newPage')}}
                v-divider(vertical)

              //- ADMIN

              template(v-if='isAuthenticated && isAdmin && mode !== `admin`')
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn(icon, tile, height='64', data-auth-required, v-on='on', href='/a', :aria-label='$t(`common:header.admin`)')
                      v-icon(color='white') mdi-cog
                  span {{$t('common:header.admin')}}
                v-divider(vertical)

              //- ACCOUNT

              v-menu(v-if='isAuthenticated', offset-y, bottom, min-width='300', transition='slide-y-transition', left)
                template(v-slot:activator='{ on: menu, attrs }')
                  v-tooltip(bottom)
                    template(v-slot:activator='{ on: tooltip }')
                      v-btn(
                        icon
                        v-bind='attrs'
                        v-on='{ ...menu, ...tooltip }'
                        :class='$vuetify.rtl ? `ml-0` : ``'
                        tile
                        height='64'
                        :aria-label='$t(`common:header.account`)'
                        )
                        v-icon(v-if='picture.kind === `initials`', color='white') mdi-account-circle
                        v-avatar(v-else-if='picture.kind === `image`', :size='34')
                          v-img(:src='picture.url')
                    span {{$t('common:header.account')}}
                v-list(nav)
                  v-list-item.py-3.grey(:class='$vuetify.theme.dark ? `darken-4-l5` : `lighten-5`')
                    v-list-item-avatar
                      v-avatar.blue(v-if='picture.kind === `initials`', :size='40')
                        span.white--text.subheading {{picture.initials}}
                      v-avatar(v-else-if='picture.kind === `image`', :size='40')
                        v-img(:src='picture.url')
                    v-list-item-content
                      v-list-item-title {{name}}
                      v-list-item-subtitle {{email}}
                  v-list-item(href='/p')
                    v-list-item-action: v-icon(color='blue-grey') mdi-face-profile
                    v-list-item-content
                      v-list-item-title(:class='$vuetify.theme.dark ? `blue-grey--text text--lighten-3` : `blue-grey--text`') {{$t('common:header.profile')}}
                  v-list-item(@click='logout')
                    v-list-item-action: v-icon(color='red') mdi-logout
                    v-list-item-title.red--text {{$t('common:header.logout')}}

              v-tooltip(v-else, left)
                template(v-slot:activator='{ on }')
                  v-btn(icon, v-on='on', href='/login', :aria-label='$t(`common:header.login`)')
                    v-icon(color='white') mdi-account-circle
                span {{$t('common:header.login')}}

      page-selector(mode='create', v-model='newPageModal', :open-handler='pageNewCreate', :locale='locale')
      page-selector(mode='move', v-model='movePageModal', :open-handler='pageMoveRename', :path='path', :locale='locale')
      page-selector(mode='create', v-model='duplicateOpts.modal', :open-handler='pageDuplicateHandle', :path='duplicateOpts.path', :locale='duplicateOpts.locale')
      page-delete(v-model='deletePageModal', v-if='path && path.length')
      page-convert(v-model='convertPageModal', v-if='path && path.length')

      .nav-header-dev(v-if='isDevMode')
        v-icon mdi-alert
        div
          .overline DEVELOPMENT VERSION
          .overline This code base is NOT for production use!

    nav-bottom-bar-host

</template>

<script>
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'
import { getLogoutUrl } from '../../helpers/auth-session'

import movePageMutation from 'gql/common/common-pages-mutation-move.gql'

/* global siteConfig, siteLangs */

const NAV_BAR_COLOR = '#192b85'

export default {
  components: {
    PageDelete: () => import('./page-delete.vue'),
    PageConvert: () => import('./page-convert.vue')
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
      movePageModal: false,
      convertPageModal: false,
      deletePageModal: false,
      locales: siteLangs,
      isDevMode: siteConfig.devMode === true,
      duplicateOpts: {
        locale: 'en',
        path: 'new-page',
        modal: false
      },
      mobileViewport: typeof window !== 'undefined' ? window.innerWidth < 960 : true
    }
  },
  computed: {
    navBarColor () {
      return NAV_BAR_COLOR
    },
    search: sync('site/search'),
    searchIsFocused: sync('site/searchIsFocused'),
    searchIsLoading: sync('site/searchIsLoading'),
    searchRestrictLocale: sync('site/searchRestrictLocale'),
    searchRestrictPath: sync('site/searchRestrictPath'),
    isLoading: get('isLoading'),
    title: get('site/title'),
    logoUrl: get('site/logoUrl'),
    path: get('page/path'),
    locale: get('page/locale'),
    mode: get('page/mode'),
    name: get('user/name'),
    email: get('user/email'),
    pictureUrl: get('user/pictureUrl'),
    isAuthenticated: get('user/authenticated'),
    permissions: get('user/permissions'),
    picture () {
      if (this.pictureUrl && this.pictureUrl.length > 1) {
        return {
          kind: 'image',
          url: (this.pictureUrl === 'internal') ? `/_userav/${this.$store.get('user/id')}` : this.pictureUrl
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
    isAdmin () {
      return _.intersection(this.permissions, ['manage:system', 'write:users', 'manage:users', 'write:groups', 'manage:groups', 'manage:navigation', 'manage:theme', 'manage:api']).length > 0
    },
    hasNewPagePermission () {
      if (!this.isAuthenticated) {
        return false
      }
      return this.hasAdminPermission || _.intersection(this.permissions, ['write:pages']).length > 0
    },
    hasAdminPermission: get('page/effectivePermissions@system.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    hasAnyPagePermissions () {
      if (!this.isAuthenticated) {
        return false
      }
      return this.hasAdminPermission || this.hasWritePagesPermission || this.hasManagePagesPermission ||
        this.hasDeletePagesPermission || this.hasReadSourcePermission || this.hasReadHistoryPermission
    },
    mobileHeaderColor () {
      return NAV_BAR_COLOR
    },
    showMobileChat () {
      return siteConfig.mobileHeaderChatEnabled === true
    },
    isEditorHeader () {
      return this.dense || this.mode === 'edit'
    }
  },
  created () {
    if (this.hideSearch || this.dense) {
      this.searchIsShown = false
    }
  },
  beforeDestroy () {
    if (this._onViewportResize) {
      window.removeEventListener('resize', this._onViewportResize)
    }
    this.$root.$off('focusMobileSearch', this.focusMobileSearch)
  },
  mounted () {
    this.syncMobileViewport()
    this._onViewportResize = _.debounce(() => {
      this.syncMobileViewport()
    }, 100)
    window.addEventListener('resize', this._onViewportResize)

    this.$root.$on('pageNew', () => {
      this.pageNew()
    })
    this.$root.$on('focusMobileSearch', this.focusMobileSearch)
    this.$root.$on('pageEdit', () => {
      this.pageEdit()
    })
    this.$root.$on('pageHistory', () => {
      this.pageHistory()
    })
    this.$root.$on('pageSource', () => {
      this.pageSource()
    })
    this.$root.$on('pageMove', () => {
      this.pageMove()
    })
    this.$root.$on('pageConvert', () => {
      this.pageConvert()
    })
    this.$root.$on('pageDuplicate', () => {
      this.pageDuplicate()
    })
    this.$root.$on('pageDelete', () => {
      this.pageDelete()
    })
  },
  methods: {
    requireAuth () {
      if (!this.isAuthenticated) {
        window.location.assign('/login')
        return false
      }
      return true
    },
    syncMobileViewport () {
      this.mobileViewport = window.innerWidth < 960
    },
    searchFocus () {
      this.searchIsFocused = true
    },
    searchBlur () {
      this.searchIsFocused = false
    },
    searchClose () {
      this.search = ''
      this.searchBlur()
    },
    openMobileNav () {
      this.$root.$emit('openNavDrawer')
    },
    focusMobileSearch () {
      this.searchIsShown = true
      this.$nextTick(() => {
        const field = this.$refs.searchFieldMobile || this.$refs.searchField
        if (field && typeof field.focus === 'function') {
          field.focus()
        }
      })
    },
    chatClick () {
      if (this.mode === 'view') {
        this.$root.$emit('goToComments')
      } else if (this.isAuthenticated) {
        window.location.assign('/p')
      } else {
        window.location.assign('/login')
      }
    },
    searchEnter () {
      this.$root.$emit('searchEnter', true)
    },
    searchMove(dir) {
      this.$root.$emit('searchMove', dir)
    },
    pageNew () {
      if (!this.requireAuth()) { return }
      this.newPageModal = true
    },
    pageNewCreate ({ path, locale }) {
      window.location.assign(`/e/${locale}/${path}`)
    },
    pageView () {
      window.location.assign(`/${this.locale}/${this.path}`)
    },
    pageEdit () {
      if (!this.requireAuth()) { return }
      window.location.assign(`/e/${this.locale}/${this.path}`)
    },
    pageHistory () {
      if (!this.requireAuth()) { return }
      window.location.assign(`/h/${this.locale}/${this.path}`)
    },
    pageSource () {
      if (!this.requireAuth()) { return }
      window.location.assign(`/s/${this.locale}/${this.path}`)
    },
    pageDuplicate () {
      if (!this.requireAuth()) { return }
      const pathParts = this.path.split('/')
      this.duplicateOpts = {
        locale: this.locale,
        path: (pathParts.length > 1) ? _.initial(pathParts).join('/') + `/new-page` : `new-page`,
        modal: true
      }
    },
    pageDuplicateHandle ({ locale, path }) {
      window.location.assign(`/e/${locale}/${path}?from=${this.$store.get('page/id')}`)
    },
    pageConvert () {
      if (!this.requireAuth()) { return }
      this.convertPageModal = true
    },
    pageMove () {
      if (!this.requireAuth()) { return }
      this.movePageModal = true
    },
    async pageMoveRename ({ path, locale }) {
      this.$store.commit(`loadingStart`, 'page-move')
      try {
        const resp = await this.$apollo.mutate({
          mutation: movePageMutation,
          variables: {
            id: this.$store.get('page/id'),
            destinationLocale: locale,
            destinationPath: path
          }
        })
        if (_.get(resp, 'data.pages.move.responseResult.succeeded', false)) {
          window.location.replace(`/${locale}/${path}`)
        } else {
          throw new Error(_.get(resp, 'data.pages.move.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
        this.$store.commit(`loadingStop`, 'page-move')
      }
    },
    pageDelete () {
      if (!this.requireAuth()) { return }
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
    async changeLocale (locale) {
      await this.$i18n.i18next.changeLanguage(locale.code)
      switch (this.mode) {
        case 'view':
        case 'history':
          window.location.assign(`/${locale.code}/${this.path}`)
          break
      }
    },
    logout () {
      window.location.assign(getLogoutUrl())
    },
    getHomeLocale () {
      const urlSegment = _.get(window.location.pathname.split('/'), '[1]')
      if (urlSegment && siteLangs.some(lc => lc.code === urlSegment)) {
        return urlSegment
      }
      if (this.locale && siteLangs.some(lc => lc.code === this.locale)) {
        return this.locale
      }
      return siteConfig.lang
    },
    goHome () {
      const locale = this.getHomeLocale()
      window.location.assign(siteLangs.length > 0 ? `/${locale}/home` : '/')
    }
  }
}
</script>

<style lang='scss'>

$nav-bar-color: #192b85;

%nav-header-search-field {
  .v-input__slot {
    background-color: #fff !important;
    border-radius: 28px !important;
  }

  input {
    color: $nav-bar-color !important;
  }

  .v-label {
    color: rgba($nav-bar-color, 0.6) !important;
  }

  .v-input__prepend-inner .v-icon,
  .v-input__append-inner .v-icon {
    color: $nav-bar-color !important;
  }
}

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

  .org-logo {
    cursor: pointer;
  }

  &-inner {
    .v-toolbar__content {
      padding: 0;
    }
  }

  &-desktop {
    &__center {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    &__search {
      @extend %nav-header-search-field;

      width: 100%;
      max-width: 420px;
    }
  }

  @media #{map-get($display-breakpoints, 'md-and-up')} {
    > .v-toolbar__content > .layout {
      width: 100%;
      margin: 0;
    }

    .nav-header-inner .v-toolbar__content {
      width: 100%;
    }

    .nav-header-inner .subheading {
      color: #fff !important;
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

  &-dev {
    background-color: mc('red', '600');
    position: absolute;
    top: 11px;
    left: 255px;
    padding: 5px 15px;
    border-radius: 5px;
    display: flex;

    @media #{map-get($display-breakpoints, 'sm-and-down')} {
      display: none;
    }

    .v-icon {
      margin-right: 15px;
    }

    .overline:nth-child(2) {
      text-transform: none;
    }
  }

  @media #{map-get($display-breakpoints, 'sm-and-down')} {
    &.v-app-bar,
    .nav-header-mobile.v-toolbar {
      background-color: $nav-bar-color !important;
      transition: none !important;
    }

    > .v-toolbar__content {
      padding-left: 8px !important;
      padding-right: 8px !important;
    }
  }

  @media #{map-get($display-breakpoints, 'md-and-up')} {
    &.v-app-bar,
    .nav-header-inner.v-toolbar {
      background-color: $nav-bar-color !important;
    }
  }
}

.theme--dark {
  @media #{map-get($display-breakpoints, 'sm-and-down')} {
    .nav-header.v-app-bar,
    .nav-header .nav-header-mobile.v-toolbar {
      background-color: $nav-bar-color !important;
    }
  }

  @media #{map-get($display-breakpoints, 'md-and-up')} {
    .nav-header.v-app-bar,
    .nav-header .nav-header-inner.v-toolbar {
      background-color: $nav-bar-color !important;
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

.nav-header-mobile-editor {
  width: 100%;
  padding: 0;

  .v-toolbar__content {
    padding: 0 8px !important;
    width: 100%;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 4px;
  }

  &__mid {
    flex: 1 1 auto;
    min-width: 0;

    .editor-title-input {
      width: 100%;
      padding-top: 0;

      .v-input__control {
        min-height: 36px !important;
      }

      .v-input__slot {
        background-color: #fff !important;
        min-height: 36px !important;
        margin-bottom: 0;
      }

      input {
        color: $nav-bar-color !important;
        caret-color: $nav-bar-color;
        text-align: center;
      }
    }
  }

  &__actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;

    .v-btn {
      display: inline-flex !important;
      visibility: visible !important;
      flex-shrink: 0;
    }
  }

  &__loading {
    width: 18px;
    margin-right: 4px;
  }
}

.nav-header-mobile {
  width: 100%;
  padding: 0;

  .v-toolbar__content {
    padding: 0 8px !important;
    width: 100%;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px;
  }

  &__menu {
    flex-shrink: 0;
    margin: 0;
  }

  &__search {
    @extend %nav-header-search-field;

    flex: 1;
    margin: 0;
    max-width: none;
    padding-top: 0;

    .v-input__control {
      min-height: 36px !important;
    }

    .v-input__slot {
      min-height: 36px !important;
      margin-bottom: 0;
    }
  }

  &__chat {
    flex-shrink: 0;
    margin: 0;
  }

  &__loading {
    position: absolute;
    right: 52px;
    width: 18px;

    @at-root .v-application--is-rtl & {
      right: auto;
      left: 52px;
    }
  }
}

</style>
