<template lang='pug'>
  v-app-bar.nav-header(
    :color='$vuetify.theme.dark ? colors.primary[`3`] : colors.white',
    app,
    :clipped-left='!$vuetify.rtl',
    :clipped-right='$vuetify.rtl',
    fixed,
    flat,
    :extended='searchIsShown && $vuetify.breakpoint.smAndDown'
    )
    v-toolbar(
      v-if='searchIsShown && $vuetify.breakpoint.smAndDown',
      :color='$vuetify.theme.dark ? colors.primary[`3`] : colors.white',
      flat,
      slot='extension'
      )
      v-text-field(
        ref='searchFieldMobile'
        v-model='search'
        clearable
        :background-color='$vuetify.theme.dark ? colors.velvet[`5`] :colors.surface[`2`]'
        :color='$vuetify.theme.dark ? colors.white : colors.primary[`1`]'
        :label='$t(`common:header.search`)'
        single-line
        solo
        flat
        hide-details
        outlined
        prepend-inner-icon='mdi-magnify'
        :loading='searchIsLoading'
        @keyup.enter='searchEnter'
        autocomplete='none'
      )
    v-layout(row)
      v-flex(xs5, md4)
        v-toolbar.nav-header-inner(
          :color='$vuetify.theme.dark ? colors.primary[`3`] : colors.white',
          flat,
          :class='$vuetify.rtl ? `pr-3` : `pl-3`'
          )
          v-avatar(tile, size='34', @click='goHome')
            v-img.org-logo(:src='logoUrl')
          v-toolbar-title(:class='{ "mx-3": $vuetify.breakpoint.mdAndUp, "mx-1": $vuetify.breakpoint.smAndDown }')
            span.subheading(:style='$vuetify.theme.dark ? `color=colors.white`: `color=colors.text.darkGrey`') {{title}}

          //- SITES

          v-menu(v-model='menuIsOpen', offset-y, bottom, transition='slide-y-transition', right)
            template(v-slot:activator='{ on: menu, attrs }')
              v-tooltip(bottom)
                template(v-slot:activator='{ on: tooltip }')
                  v-btn.hover-text(
                    icon
                    v-bind='attrs'
                    v-on='{ ...menu }'
                    :class='{ "ml-3": $vuetify.rtl, "color-theme-dark": $vuetify.theme.dark }'
                    tile
                    height='64'
                    width='100'
                    )
                    span(:style='$vuetify.theme.dark ? `color=colors.white`: `color=colors.text.darkGrey`') Sites
                    v-icon(:color='$vuetify.theme.dark ? `color=colors.white`: `color=colors.text.darkGrey`')  {{ menuIsOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}}
            v-list(
                style="overflow-y: auto; box-shadow: 0 3px 5px -1px rgba(0, 0, 0, .2); 0 6px 10px 0 rgba(0, 0, 0, .14); 0 1px 18px 0 rgba(0, 0, 0, .12);"
                nav,
                :class='{ "color-theme-dark": $vuetify.theme.dark }'
                class='sitesList'
              )
              v-list-item.pl-4(v-for='site in sites' :key='site.id', @click='goToSite(site.value)' style="white-space: nowrap; overflow: hidden; text-overflow: ellipses;" :id='site.value === sitePath ? `selected-site-item` : ``')
                v-list-item-title.body-2 {{ site.text }}
          v-divider(vertical)

      v-flex(md4, v-if='$vuetify.breakpoint.mdAndUp')
        v-toolbar.nav-header-inner(:color='$vuetify.theme.dark ? colors.primary[`3`] : colors.white', flat)
          slot(name='mid')

            transition(name='navHeaderSearch', v-if='searchIsShown')
              v-text-field(
                ref='searchField',
                v-if='searchIsShown && $vuetify.breakpoint.mdAndUp',
                v-model='search',
                :color='$vuetify.theme.dark ? colors.white : colors.primary[`1`]',
                :background-color='$vuetify.theme.dark ? colors.velvet[`5`] : colors.white',
                :label='$t(`common:header.search`)',
                single-line,
                solo
                flat
                rounded
                hide-details,
                outlined,
                prepend-inner-icon='mdi-magnify',
                :loading='searchIsLoading',
                @keyup.enter='searchEnter'
                @keyup.esc='searchClose'
                @focus='searchFocus'
                @blur='searchBlur'
                @keyup.down='searchMove(`down`)'
                @keyup.up='searchMove(`up`)'
                autocomplete='none'
              )

            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn.ml-2.mr-0.hover-icon(
                  icon,
                  v-on='on',
                  :href='`/t/`+ sitePath',
                  :aria-label='$t(`common:header.browseTags`)',
                  :class='{ "color-theme-dark": $vuetify.theme.dark }'
                  )
                  v-icon(color='grey') mdi-tag-multiple
              span {{$t('common:header.browseTags')}}
      v-flex(xs7, md4)
        v-toolbar.nav-header-inner.pr-4(:color='$vuetify.theme.dark ? colors.primary[`3`] : colors.white', flat)
          v-spacer
          .navHeaderLoading.mr-3
            v-progress-circular(indeterminate, color='blue', :size='22', :width='2' v-show='isLoading')

          slot(name='actions')

          //- (mobile) SEARCH TOGGLE

          v-btn.hover-icon(
            v-if='!hideSearch && $vuetify.breakpoint.smAndDown'
            :class='{ "color-theme-dark": $vuetify.theme.dark }'
            @click='searchToggle'
            icon
            )
            v-icon(color='grey') mdi-magnify

          //- LANGUAGES

          template(v-if='mode === `view` && locales.length > 0')
            v-menu(offset-y, bottom, transition='slide-y-transition', max-height='320px', min-width='210px', left)
              template(v-slot:activator='{ on: menu, attrs }')
                v-tooltip(bottom)
                  template(v-slot:activator='{ on: tooltip }')
                    v-btn.hover-icon(
                      icon
                      v-bind='attrs'
                      v-on='{ ...menu, ...tooltip }'
                      :class='{ "ml-3": $vuetify.rtl, "color-theme-dark": $vuetify.theme.dark }'
                      tile
                      height='64'
                      :aria-label='$t(`common:header.language`)'
                      )
                      v-icon(color='grey') mdi-web
                  span {{$t('common:header.language')}}
              v-list(nav)
                template(v-for='(lc, idx) of locales')
                  v-list-item(@click='changeLocale(lc)')
                    v-list-item-action(style='min-width:auto;'): v-chip(:color='lc.code === locale ? `blue` : `grey`', small, label) {{lc.code.toUpperCase()}}
                    v-list-item-title {{lc.name}}
            v-divider(vertical)

          //- Follow Site

          template(v-if='isAuthenticated && path && !isFollowingSite')
            v-tooltip(bottom)
              template( v-slot:activator='{ on }')
                v-btn.hover-icon(icon, tile, height='64', v-on='on', @click='followSite', :aria-label='$t(`common:header.followSite`)'
                :class='{ "ml-3": $vuetify.rtl, "color-theme-dark": $vuetify.theme.dark }'
                )
                  v-icon(color='grey') mdi-track-light
              span Follow Site
            v-divider(vertical)

          template(v-if='isAuthenticated && path && isFollowingSite')
            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn.hover-icon(icon, tile, height='64', v-on='on', @click='unfollowSite', :aria-label='$t(`common:header.unfollowSite`)'
                :class='{ "ml-3": $vuetify.rtl, "color-theme-dark": $vuetify.theme.dark }'
                )
                  v-icon(color='grey') mdi-track-light-off
              span Unfollow Site
            v-divider(vertical)

          //- PAGE ACTIONS

          template(v-if='hasAnyPagePermissions && path && mode !== `edit`')
            v-menu(offset-y, bottom, transition='slide-y-transition', left)
              template(v-slot:activator='{ on: menu, attrs }')
                v-tooltip(bottom)
                  template(v-slot:activator='{ on: tooltip }')
                    v-btn.hover-icon(
                      icon
                      v-bind='attrs'
                      v-on='{ ...menu, ...tooltip }'
                      :class='{ "ml-3": $vuetify.rtl, "color-theme-dark": $vuetify.theme.dark }'
                      tile
                      height='64'
                      :aria-label='$t(`common:header.pageActions`)'
                      )
                      v-icon(color='grey') mdi-file-document-edit-outline
                  span {{$t('common:header.pageActions')}}
              v-list(nav, :class='{ "color-theme-dark": $vuetify.theme.dark }')
                .overline.pa-4.grey--text {{$t('common:header.currentPage')}}
                v-list-item.pl-4(@click='pageView', v-if='mode !== `view`')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='$vuetify.theme.dark ? colors.teal[`1`] : colors.teal[`4`]'
                    ) mdi-file-document-outline
                  v-list-item-title.body-2 {{$t('common:header.view')}}
                v-list-item.pl-4(@click='pageEdit', v-if='mode !== `edit` && hasWritePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='$vuetify.theme.dark ? colors.teal[`1`] : colors.teal[`4`]'
                    ) mdi-file-document-edit-outline
                  v-list-item-title.body-2 {{$t('common:header.edit')}}
                v-list-item.pl-4(@click='pageHistory', v-if='mode !== `history` && hasReadHistoryPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='$vuetify.theme.dark ? colors.teal[`1`] : colors.teal[`4`]'
                    ) mdi-history
                  v-list-item-content
                    v-list-item-title.body-2 {{$t('common:header.history')}}
                v-list-item.pl-4(@click='pageSource', v-if='mode !== `source` && hasReadSourcePermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='$vuetify.theme.dark ? colors.teal[`1`] : colors.teal[`4`]'
                    ) mdi-code-tags
                  v-list-item-title.body-2 {{$t('common:header.viewSource')}}
                v-list-item.pl-4(@click='pageConvert', v-if='hasWritePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='$vuetify.theme.dark ? colors.teal[`1`] : colors.teal[`4`]'
                    ) mdi-lightning-bolt
                  v-list-item-title.body-2 {{$t('common:header.convert')}}
                v-list-item.pl-4(@click='pageDuplicate', v-if='hasWritePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='$vuetify.theme.dark ? colors.teal[`1`] : colors.teal[`4`]'
                    ) mdi-content-duplicate
                  v-list-item-title.body-2 {{$t('common:header.duplicate')}}
                v-list-item.pl-4(@click='pageMove', v-if='hasManagePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='$vuetify.theme.dark ? colors.teal[`1`] : colors.teal[`4`]'
                    ) mdi-content-save-move-outline
                  v-list-item-content
                    v-list-item-title.body-2 {{$t('common:header.move')}}
                v-list-item.pl-4(@click='pageDelete', v-if='hasDeletePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(:color='colors.red[`4`]') mdi-trash-can-outline
                  v-list-item-title.body-2 {{$t('common:header.delete')}}
            v-divider(vertical)

          //- NEW PAGE

          template(v-if='hasNewPagePermission && path && mode !== `edit`')
            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn.hover-icon(
                  icon,
                  tile,
                  height='64',
                  v-on='on',
                  @click='pageNew',
                  :aria-label='$t(`common:header.newPage`)',
                  :class='{ "color-theme-dark": $vuetify.theme.dark }'
                  )
                  v-icon(color='grey') mdi-text-box-plus-outline
              span {{$t('common:header.newPage')}}
            v-divider(vertical)

          //- ADMIN

          template(v-if='isAuthenticated && isAdmin')
            v-tooltip(bottom, v-if='mode !== `admin`')
              template(v-slot:activator='{ on }')
                v-btn.hover-icon(
                  icon,
                  tile,
                  height='64',
                  v-on='on',
                  href='/a',
                  :aria-label='$t(`common:header.admin`)',
                  :class='{ "color-theme-dark": $vuetify.theme.dark }'
                  )
                  v-icon(color='grey') mdi-cog
              span {{$t('common:header.admin')}}
            v-btn.hover-icon(
              v-else,
              text,
              tile,
              height='64',
              href='/',
              :aria-label='$t(`common:actions.exit`)',
              :class='{ "color-theme-dark": $vuetify.theme.dark }'
              )
              v-icon(left, color='grey') mdi-exit-to-app
              span {{$t('common:actions.exit')}}
            v-divider(vertical)

          //- ACCOUNT

          v-menu(v-if='isAuthenticated', offset-y, bottom, min-width='300', transition='slide-y-transition', left)
            template(v-slot:activator='{ on: menu, attrs }')
              v-tooltip(bottom)
                template(v-slot:activator='{ on: tooltip }')
                  v-btn.hover-icon(
                    icon
                    v-bind='attrs'
                    v-on='{ ...menu, ...tooltip }'
                    :class='{ "ml-0": $vuetify.rtl, "color-theme-dark": $vuetify.theme.dark }'
                    tile
                    height='64'
                    :aria-label='$t(`common:header.account`)'
                    )
                    v-icon(v-if='picture.kind === `initials`', color='grey') mdi-account-circle
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
              //- v-list-item(href='/w', disabled)
              //-   v-list-item-action: v-icon(color='blue') mdi-view-compact-outline
              //-   v-list-item-content
              //-     v-list-item-title {{$t('common:header.myWiki')}}
              //-     v-list-item-subtitle.overline Coming soon
              v-list-item(href='/p')
                v-list-item-action: v-icon(color='blue-grey') mdi-face-profile
                v-list-item-content
                  v-list-item-title(:class='$vuetify.theme.dark ? `blue-grey--text text--lighten-3` : `blue-grey--text`') {{$t('common:header.profile')}}
              v-list-item(@click='logout')
                v-list-item-action: v-icon(color='red') mdi-logout
                v-list-item-title.red--text {{$t('common:header.logout')}}

          v-tooltip(v-else, left)
            template(v-slot:activator='{ on }')
              v-btn.hover-icon(
                icon,
                v-on='on',
                color='grey darken-3',
                href='/login',
                :aria-label='$t(`common:header.login`)',
                :class='{ "color-theme-dark": $vuetify.theme.dark }'
                )
                v-icon(color='grey') mdi-account-circle
            span {{$t('common:header.login')}}

    page-selector(
      mode='create',
      v-model='newPageModal',
      :open-handler='pageNewCreate',
      :locale='locale'
    )

    page-selector(
      mode='move',
      v-model='movePageModal',
      :open-handler='pageMoveRename',
      :path='path',
      :locale='locale'
    )

    page-selector(mode='create',
      v-model='duplicateOpts.modal',
      :open-handler='pageDuplicateHandle',
      :path='duplicateOpts.path',
      :locale='duplicateOpts.locale'
    )

    page-delete(
      v-model='deletePageModal', v-if='path && path.length'
    )

    page-convert(
      v-model='convertPageModal', v-if='path && path.length'
    )

    //- .nav-header-dev(v-if='isDevMode')
    //-  v-icon mdi-alert
    //-  div
    //-    .overline DEVELOPMENT VERSION
    //-    .overline This code base is NOT for production use!
</template>

<script>
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'

import colors from '@/themes/default/js/extended-color-scheme'

import movePageMutation from 'gql/common/common-pages-mutation-move.gql'
import createFollowerMutation from 'gql/followers/create-follower.gql'
import deleteFollowerMutation from 'gql/followers/delete-follower.gql'
import isFollowingQuery from 'gql/followers/is-following.gql'

/* global siteConfig, siteLangs */

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
      isFollowingSite: false,
      menuIsShown: true,
      searchIsShown: true,
      searchAdvMenuShown: false,
      newPageModal: false,
      movePageModal: false,
      convertPageModal: false,
      deletePageModal: false,
      locales: siteLangs,
      isDevMode: false,
      duplicateOpts: {
        locale: 'en',
        path: 'new-page',
        modal: false
      },
      sites: [],
      menuIsOpen: false,
      colors: colors,
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
    logoUrl: get('site/logoUrl'),
    path: get('page/path'),
    locale: get('page/locale'),
    mode: get('page/mode'),
    name: get('user/name'),
    email: get('user/email'),
    pictureUrl: get('user/pictureUrl'),
    isAuthenticated: get('user/authenticated'),
    permissions: get('user/permissions'),
    sitesWithWriteAccess: get('user/sitesWithWriteAccess'),
    sitePath: get('page/sitePath'),
    siteId: get('page/siteId'),
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
      return _.intersection(this.permissions, [
        'manage:system',
        'write:users',
        'manage:users',
        'write:groups',
        'manage:groups',
        'manage:navigation',
        'manage:theme',
        'manage:api',
        'manage:sites'
      ]).length > 0
    },
    hasNewPagePermission () {
      return this.hasAdminPermission || this.sitesWithWriteAccess.includes(this.siteId)
    },
    hasAdminPermission: get('page/effectivePermissions@system.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    hasAnyPagePermissions () {
      return this.hasAdminPermission || this.hasWritePagesPermission || this.hasManagePagesPermission ||
        this.hasDeletePagesPermission || this.hasReadSourcePermission || this.hasReadHistoryPermission
    }
  },
  created () {
    if (this.hideSearch || this.dense || this.$vuetify.breakpoint.smAndDown) {
      this.searchIsShown = false
    }
    if (this.path) this.checkIfFollowingSite()
  },
  mounted () {
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
    this.isDevMode = siteConfig.devMode === true
    this.fetchSitesFromUser()
  },
  methods: {
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
    searchToggle () {
      this.searchIsShown = !this.searchIsShown
      if (this.searchIsShown) {
        _.delay(() => {
          this.$refs.searchFieldMobile.focus()
        }, 200)
      }
    },
    searchEnter () {
      this.$root.$emit('searchEnter', true)
    },
    searchMove(dir) {
      this.$root.$emit('searchMove', dir)
    },
    pageNew () {
      this.newPageModal = true
    },
    pageNewCreate ({ path, locale }) {
      window.location.assign(`/e/${this.sitePath}/${locale}/${path}`)
    },
    pageView () {
      window.location.assign(`/${this.sitePath}/${this.locale}/${this.path}`)
    },
    pageEdit () {
      window.location.assign(`/e/${this.sitePath}/${this.locale}/${this.path}`)
    },
    pageHistory () {
      window.location.assign(`/h/${this.sitePath}/${this.locale}/${this.path}`)
    },
    pageSource () {
      window.location.assign(`/s/${this.sitePath}/${this.locale}/${this.path}`)
    },
    pageDuplicate () {
      const pathParts = this.path.split('/')
      this.duplicateOpts = {
        locale: this.locale,
        path: (pathParts.length > 1) ? _.initial(pathParts).join('/') + `/new-page` : `new-page`,
        modal: true
      }
    },
    pageDuplicateHandle ({ locale, path }) {
      window.location.assign(`/e/${this.sitePath}/${locale}/${path}?from=${this.$store.get('page/id')}`)
    },
    pageConvert () {
      this.convertPageModal = true
    },
    pageMove () {
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
          window.location.replace(`/${this.sitePath}/${locale}/${path}`)
        } else {
          throw new Error(_.get(resp, 'data.pages.move.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
        this.$store.commit(`loadingStop`, 'page-move')
      }
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
    async changeLocale (locale) {
      await this.$i18n.i18next.changeLanguage(locale.code)
      switch (this.mode) {
        case 'view':
        case 'history':
          window.location.assign(`/${this.sitePath}/${locale.code}/${this.path}`)
          break
      }
    },
    logout () {
      window.location.assign('/logout')
    },
    goHome () {
      window.location.assign(`/${this.sitePath}`)
    },
    goToSite (path) {
      window.location.assign(`/${path || ''}`)
    },
    async fetchSitesFromUser() {
      try {
        const response = await this.$store.dispatch('user/fetchSites', { apolloClient: this.$apollo })
        const sitesData = response?.data?.sites || []

        this.sites = Object.values(sitesData).map(site => {
          return {
            id: site.id,
            value: site.path,
            text: site.name
          }
        })
      } catch (error) {
        console.error(error)
        this.sites = []
      }
    },
    async checkIfFollowingSite() {
      try {
        const response = await this.$apollo.query({
          query: isFollowingQuery,
          variables: { siteId: this.siteId, pageId: null }
        })
        this.isFollowingSite = response.data.isFollowing.isFollowing
      } catch (error) {
        console.error('Error checking if following site:', error)
      }
    },
    async followSite() {
      try {
        const response = await this.$apollo.mutate({
          mutation: createFollowerMutation,
          variables: {
            siteId: this.siteId,
            pageId: null
          }
        })
        if (response.data.createFollower.operation.succeeded) {
          this.isFollowingSite = true
          this.$store.commit('showNotification', {
            style: 'green',
            message: 'Successfully followed the site.',
            icon: 'check_circle'
          })
        } else {
          console.error('Error following site:', response.data.createFollower.operation.message)
          this.$store.commit('showNotification', {
            style: 'red',
            message: 'An error occurred while trying to follow the site.',
            icon: 'error'
          })
        }
      } catch (error) {
        console.error('Error following site:', error)
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'An error occurred while trying to follow the site.',
          icon: 'error'
        })
      }
    },
    async unfollowSite() {
      try {
        const response = await this.$apollo.mutate({
          mutation: deleteFollowerMutation,
          variables: {
            siteId: this.siteId,
            pageId: null
          }
        })
        if (response.data.deleteFollower.responseResult.succeeded) {
          this.isFollowingSite = false
          this.$store.commit('showNotification', {
            style: 'green',
            message: 'Successfully unfollowed the site.',
            icon: 'check_circle'
          })
        } else {
          console.error('Error unfollowing site:', response.data.deleteFollower.message)
          this.$store.commit('showNotification', {
            style: 'red',
            message: 'An error occurred while trying to unfollow the site.',
            icon: 'error'
          })
        }
      } catch (error) {
        console.error('Error unfollowing site:', error)
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'An error occurred while trying to unfollow the site.',
          icon: 'error'
        })
      }
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

  .org-logo {
    cursor: pointer;
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

  &-dev {
    background-color: mc('red', '600');
    position: absolute;
    top: 11px;
    left: 255px;
    padding: 5px 15px;
    border-radius: 5px;
    display: flex;

    .v-icon {
      margin-right: 15px;
    }

    .overline:nth-child(2) {
      text-transform: none;
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

.sitesList {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  max-height: 500px;
  min-width: 160px; /* Adjust for small screens */
}

@media (min-width: 1201px) {
  .sitesList {
    max-width: 400px; /* Adjust for large screens */
  }
}

#selected-site-item > div {
  font-weight: 600;
}

.hover-text {
  &:hover > .v-btn__content > span {
    color: mc("primary", "1");
  }

  &.color-theme-dark {
    &:hover > .v-btn__content > span {
      color: mc("ext-teal", "1");
    }
  }
}

.hover-icon {
  &:hover > .v-btn__content > .v-icon {
    color: mc("primary", "1") !important;
  }

  &.color-theme-dark {
    &:hover > .v-btn__content > .v-icon {
      color: mc("ext-teal", "1") !important;
    }
  }
}

.color-theme-dark {
  background-color: mc("primary", "3") !important;
  color: white !important;
}
</style>
