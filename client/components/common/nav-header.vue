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

      //- Mobile view: menu | search | chat (+ shared actions in bottom bar)
      v-toolbar.nav-header-mobile(v-else-if='mobileViewport', :color='navBarColor', dark, flat)
        nav-action-items(preset='mobile-top', layout='inline')
          template(#search)
            v-text-field.nav-header-mobile__search(
              ref='searchFieldMobile'
              v-model='search'
              clearable
              background-color='white'
              :color='navBarColor'
              light
              :placeholder='searchLabel'
              :aria-label='searchLabel'
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
            v-toolbar.nav-header-inner.nav-header-inner--center(:color='navBarColor', dark, flat)
              .nav-header-desktop__center
                v-text-field.nav-header-desktop__search(
                  v-if='searchIsShown',
                  ref='searchField',
                  v-model='search',
                  background-color='white'
                  :color='navBarColor'
                  light
                  :placeholder='searchLabel'
                  :aria-label='searchLabel'
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
                slot(name='mid')
          v-flex(md4)
            v-toolbar.nav-header-inner.pr-4(:color='navBarColor', dark, flat)
              v-spacer
              .navHeaderLoading.mr-3
                v-progress-circular(indeterminate, color='white', :size='22', :width='2' v-show='isLoading')

              nav-action-items(v-if='!dense', preset='desktop', layout='desktop')

              slot(name='actions')

      .nav-header-dev(v-if='isDevMode')
        v-icon mdi-alert
        div
          .overline DEVELOPMENT VERSION
          .overline This code base is NOT for production use!

    page-selector(mode='create', v-model='newPageModal', :open-handler='pageNewCreate', :locale='locale')
    page-selector(mode='move', v-model='movePageModal', :open-handler='pageMoveRename', :path='path', :locale='locale')
    page-selector(mode='create', v-model='duplicateOpts.modal', :open-handler='pageDuplicateHandle', :path='duplicateOpts.path', :locale='duplicateOpts.locale')
    page-delete(v-model='deletePageModal', v-if='path && path.length')
    page-convert(v-model='convertPageModal', v-if='path && path.length')

    nav-bottom-bar-host

</template>

<script>
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'

import movePageMutation from 'gql/common/common-pages-mutation-move.gql'
import NavActionItems from './nav-action-items.vue'
import PageDelete from './page-delete.vue'
import PageConvert from './page-convert.vue'
import { NAV_BAR_COLOR } from '../../helpers/theme-colors'

/* global siteConfig, siteLangs */

export default {
  components: {
    NavActionItems,
    PageDelete,
    PageConvert
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
    isAuthenticated: get('user/authenticated'),
    permissions: get('user/permissions'),
    hasAdminPermission: get('page/effectivePermissions@system.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    isEditorHeader () {
      return this.dense || this.mode === 'edit'
    },
    searchLabel () {
      return this.$t('common:header.search')
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
    focusMobileSearch () {
      this.searchIsShown = true
      this.$nextTick(() => {
        const field = this.$refs.searchFieldMobile || this.$refs.searchField
        if (field && typeof field.focus === 'function') {
          field.focus()
        }
      })
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

%nav-header-search-field {
  .v-input__slot {
    background-color: #fff !important;
    border-radius: 28px !important;
  }

  input {
    color: $nav-bar-color !important;
  }

  input::placeholder {
    color: rgba($nav-bar-color, 0.6) !important;
    opacity: 1;
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

    &--center .v-toolbar__content {
      justify-content: center;
      align-items: center;
    }
  }

  &-desktop {
    &__center {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    &__search {
      @extend %nav-header-search-field;

      width: 100%;
      max-width: 420px;
      padding-top: 0;
      flex-shrink: 0;

      .v-input__control {
        min-height: 36px !important;
      }

      .v-input__slot {
        min-height: 36px !important;
        margin-bottom: 0;
      }
    }
  }

  @media #{map-get($display-breakpoints, 'md-and-up')} {
    > .v-toolbar__content > .layout {
      width: 100%;
      margin: 0;
    }

    .nav-header-inner .v-toolbar__content {
      width: 100%;
      flex-wrap: nowrap;
    }

    .nav-header-inner.pr-4 .v-toolbar__content {
      justify-content: flex-end;
      gap: 4px;
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
    left: var(--nav-drawer-desktop-width);
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
