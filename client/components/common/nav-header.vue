<template lang='pug'>
  v-app-bar.nav-header(
    :color='colors.surfaceDark.primaryBlueLite',
    app,
    :clipped-left='!$vuetify.rtl',
    :clipped-right='$vuetify.rtl',
    fixed,
    flat,
    :extended='searchIsShown && $vuetify.breakpoint.smAndDown'
    )
    v-toolbar(
      v-if='searchIsShown && $vuetify.breakpoint.smAndDown',
      :color='colors.surfaceDark.primaryBlueLite',
      flat,
      slot='extension'
      )
      v-text-field.mobile-search-field(
        ref='searchFieldMobile'
        v-model='search'
        clearable
        :background-color='colors.surfaceLight.inverse'
        :style='{ caretColor: colors.actionLight.highlightOnLite, color: colors.actionLight.highlightOnLite }'
        :color='colors.textDark.primary'
        :label='$t(`common:header.search`)'
        single-line
        solo
        flat
        hide-details
        outlined
        rounded
        prepend-inner-icon='mdi-magnify'
        :loading='searchIsLoading'
        @keyup.enter='searchEnter'
        autocomplete='off'
      )
    v-layout(row)
      v-flex(xs5, md4)
        v-toolbar.nav-header-inner(
          :color='colors.surfaceDark.primaryBlueLite',
          flat,
          :class='$vuetify.rtl ? `pr-3` : `pl-3`'
          )
          v-avatar(tile, size='34', @click='goHome')
            v-img.org-logo(:src='logoUrl')
          v-toolbar-title(:class='{ "mx-3": $vuetify.breakpoint.mdAndUp, "mx-1": $vuetify.breakpoint.smAndDown }')
            span.subheading(
              :style="{ color: colors.textDark.primary }"
              ) {{title}}

          //- SITES

          v-menu(v-model='menuIsOpen', offset-y, bottom, transition='slide-y-transition', right)
            template(v-slot:activator='{ on: menu, attrs }')
              v-tooltip(bottom)
                template(v-slot:activator='{ on: tooltip }')
                  v-btn.hover-text.hover-icon(
                    icon
                    v-bind='attrs'
                    v-on='{ ...menu }'
                    :class='{ "ml-3": $vuetify.rtl }'
                    tile
                    height='64'
                    width='100'
                    data-tour='site-selector'
                    )
                    span Sites
                    v-icon(:color='colors.textDark.primary')  {{ menuIsOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}}
            v-list.dropdown-list(
                style="overflow-y: auto; box-shadow: 0 3px 5px -1px rgba(0, 0, 0, .2); 0 6px 10px 0 rgba(0, 0, 0, .14); 0 1px 18px 0 rgba(0, 0, 0, .12);"
                nav
                rounded
                :class='{ "color-theme-dark": $vuetify.theme.dark }'
                class='sitesList'
              )
              v-list-item.pl-4(v-for='site in sites' :key='site.id', @click='goToSite(site.value)' style="white-space: nowrap; overflow: hidden; text-overflow: ellipses;" :id='site.value === sitePath ? `selected-site-item` : ``')
                v-list-item-title.body-2 {{ site.text }}

      v-flex(md4, v-if='$vuetify.breakpoint.mdAndUp')
        v-toolbar.nav-header-inner(:color='colors.surfaceDark.primaryBlueLite', flat)
          slot(name='mid')

            //- SEARCH-FIELD
            transition(name='navHeaderSearch')
              v-text-field.search-field(
                ref='searchField',
                v-if='$vuetify.breakpoint.mdAndUp',
                v-model='search',
                :color='colors.textDark.primary',
                :background-color='colors.surfaceLight.secondaryNeutralLite',
                :label='$t(`common:header.search`)',
                single-line,
                solo
                flat
                rounded
                hide-details,
                outlined,
                append-icon='mdi-magnify',
                :loading='searchIsLoading',
                @keyup.enter='searchEnter'
                @keyup.esc='searchClose'
                @focus='searchFocus'
                @blur='searchBlur'
                @keyup.down='searchMove(`down`)'
                @keyup.up='searchMove(`up`)'
                autocomplete='off'
              )

            //- BROWSE BY TAGS
            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn.ml-2.mr-0.hover-icon(
                  icon,
                  v-on='on',
                  :href='`/t/`+ sitePath',
                  :aria-label='$t(`common:header.browseTags`)'
                  )
                  v-icon(color='grey') mdi-tag-multiple
              span {{$t('common:header.browseTags')}}
      v-flex(xs7, md4)
        v-toolbar.nav-header-inner.pr-4(:color='colors.surfaceDark.primaryBlueLite', flat)
          v-spacer
          .navHeaderLoading.mr-3
            v-progress-circular(indeterminate, color='blue', :size='22', :width='2' v-show='isLoading')

          slot(name='actions')

          //- (mobile) SEARCH TOGGLE

          v-btn.hover-icon(
            v-if='!hideSearch && $vuetify.breakpoint.smAndDown'
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
                      :class='{ "ml-3": $vuetify.rtl }'
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
                v-btn.hover-icon(
                  icon,
                  tile,
                  height='64',
                  v-on='on',
                  @click='followSite',
                  :aria-label='$t(`common:header.followSite`)',
                  :class='{ "ml-3": $vuetify.rtl }',
                  data-tour='follow-site'
                )
                  v-icon(color='grey') mdi-track-light
              span Follow Site
            v-divider(vertical)

          template(v-if='isAuthenticated && path && isFollowingSite')
            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn.hover-icon(
                  icon,
                  tile,
                  height='64',
                  v-on='on',
                  @click='unfollowSite',
                  :aria-label='$t(`common:header.unfollowSite`)',
                  :class='{ "ml-3": $vuetify.rtl }',
                  data-tour='unfollow-site'
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
                      :class='{ "ml-3": $vuetify.rtl }'
                      tile
                      height='64'
                      :aria-label='$t(`common:header.pageActions`)'
                      data-tour='page-actions'
                      )
                      v-icon(color='grey') mdi-file-document-edit-outline
                  span {{$t('common:header.pageActions')}}
              v-list.dropdown-list(
                nav
                :class='$vuetify.theme.dark ? `color-theme-dark` : ``'
                )
                .overline.pa-4.grey--text.text--darken-1 {{$t('common:header.currentPage')}}
                v-list-item.pl-4(@click='pageView', v-if='mode !== `view`')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='getPageActionIconColor'
                    ) mdi-file-document-outline
                  v-list-item-title.body-2 {{$t('common:header.view')}}
                v-list-item.pl-4(@click='pageEdit', v-if='mode !== `edit` && hasWritePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='getPageActionIconColor'
                    ) mdi-file-document-edit-outline
                  v-list-item-title.body-2 {{$t('common:header.edit')}}
                v-list-item.pl-4(@click='pageHistory', v-if='mode !== `history` && hasReadHistoryPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='getPageActionIconColor'
                    ) mdi-history
                  v-list-item-content
                    v-list-item-title.body-2 {{$t('common:header.history')}}
                v-list-item.pl-4(@click='pageSource', v-if='mode !== `source` && hasReadSourcePermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='getPageActionIconColor'
                    ) mdi-code-tags
                  v-list-item-title.body-2 {{$t('common:header.viewSource')}}
                v-list-item.pl-4(@click='pageConvert', v-if='hasWritePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='getPageActionIconColor'
                    ) mdi-lightning-bolt
                  v-list-item-title.body-2 {{$t('common:header.convert')}}
                v-list-item.pl-4(@click='pageDuplicate', v-if='hasWritePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='getPageActionIconColor'
                    ) mdi-content-duplicate
                  v-list-item-title.body-2 {{$t('common:header.duplicate')}}
                v-list-item.pl-4(@click='pageMove', v-if='hasManagePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(
                    :color='getPageActionIconColor'
                    ) mdi-content-save-move-outline
                  v-list-item-content
                    v-list-item-title.body-2 {{$t('common:header.move')}}
                v-list-item.pl-4(@click='pageDelete', v-if='hasDeletePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(:color='trashCanColor') mdi-trash-can-outline
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
                  data-tour='new-page'
                  )
                  v-icon(color='grey') mdi-text-box-plus-outline
              span {{$t('common:header.newPage')}}
            v-divider(vertical)

          //- Resources (GitHub & Release Notes)

          template(v-if='isAuthenticated && path && mode !== `edit`')
            v-menu(offset-y, bottom, min-width='200', transition='slide-y-transition', left)
              template(v-slot:activator='{ on: menu, attrs }')
                v-tooltip(bottom)
                  template(v-slot:activator='{ on: tooltip }')
                    v-btn.hover-icon(
                      icon
                      v-bind='attrs'
                      v-on='{ ...menu, ...tooltip }'
                      tile
                      height='64'
                      :aria-label='`Resources`'
                    )
                      v-icon(color='grey') mdi-information-outline
                  span Resources
              v-list(nav)
                v-list-item(@click='goToRepo')
                  v-list-item-icon
                    v-icon mdi-github
                  v-list-item-title {{$t('common:github.repository')}}
                v-list-item(@click='openReleaseNotes')
                  v-list-item-icon
                    v-icon mdi-newspaper-variant-outline
                  v-list-item-title Release Notes
                v-list-item(@click='startTour')
                  v-list-item-icon
                    v-icon mdi-map-marker-path
                  v-list-item-title Start Tour
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
                  :aria-label='$t(`common:header.admin`)'
                  )
                  v-icon(color='grey') mdi-cog
              span {{$t('common:header.admin')}}
            v-btn.hover-icon.hover-text(
              v-else,
              text,
              tile,
              height='64',
              href='/',
              :aria-label='$t(`common:actions.exit`)'
              )
              v-icon(left, color='grey') mdi-exit-to-app
              span {{$t('common:actions.exit')}}
            v-divider(vertical)

          //- PROFILE EXIT

          template(v-if='isAuthenticated && mode === `profile`')
            v-btn.hover-icon.hover-text(
              text,
              tile,
              height='64',
              @click='handleProfileExit',
              :aria-label='$t(`common:actions.exit`)'
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
                    :class='{ "ml-0": $vuetify.rtl }'
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
                :aria-label='$t(`common:header.login`)'
                )
                v-icon(color='grey') mdi-account-circle
            span {{$t('common:header.login')}}

    page-selector(
      mode='create',
      v-model='newPageModal',
      :open-handler='pageNewCreate',
      :path='path',
      :locale='locale'
    )

    page-selector(
      mode='move',
      v-model='movePageModal',
      :open-handler='pageMoveRename',
      :path='path',
      :locale='locale',
      :currentPagePath='path'
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
    
    //- Release Notes Dialog
    v-dialog(v-model='releaseNotesDialog', max-width='60%', max-height='250', scrollable, :retain-focus='false')
      v-card
        v-card-title.d-flex.align-center(:style='{"background-color": $vuetify.theme.dark ? colors.surfaceDark.primaryBlueHeavy : colors.surfaceLight.primaryBlueHeavy, "color": colors.textDark.primary}')
          span.headline.font-weight-medium Release Notes
          v-spacer
          v-btn.mr-3(icon, @click='closeReleaseNotes', :aria-label='`Close Release Notes dialog`', :style='{"color": colors.textDark.primary}')
            v-icon mdi-close
        v-divider

        //- Upgrade success message
        v-alert(
          v-if='isUpgradeNotification'
          type='info'
          colored-border
          border='left'
          elevation='2'
          class='ma-4'
        )
          .d-flex.align-center
            div
              .text-h6.font-weight-bold {{ $t('common:release.upgradeTitle') }}
              .body-2 {{ $t('common:release.upgradeBody') }}

        v-card-text
          v-progress-linear(indeterminate, color='primary', class='mb-4', v-if='releaseNotesLoading')
          v-alert(type='error', outlined, dense, v-if='releaseNotesError') {{ releaseNotesError }}
          div(v-if='!releaseNotesLoading && !releaseNotesError')
            div(v-if='releaseInfos.length === 0', class='body-2 grey--text text-center') No release notes available.
            div(v-for='ri in releaseInfos' :key='ri.versionNumber' class='mb-6 release-info-block')
              .body-1.font-weight-bold {{ ri.versionNumber }} · {{ formatReleaseDate(ri.releaseDate) }}
              ul.release-notes-list
                li(v-for='note in ri.notes' :key='note.id') {{ localizeReleaseNote(note) }}
        v-card-actions.d-flex.justify-end.pr-4
          v-btn.rounded-button(
            rounded
            depressed
            :dark='!$vuetify.theme.dark'
            :color='releaseNotesCloseColor'
            @click='closeReleaseNotes'
            :aria-label='`Close Release Notes dialog`'
          )
            span Close

    //- Vue Tour Component
    v-tour(name='appTour', :steps='tourSteps', :callbacks='tourCallbacks')

    //- .nav-header-dev(v-if='isDevMode')
    //-  v-icon mdi-alert
    //-  div
    //-    .overline DEVELOPMENT VERSION
    //-    .overline This code base is NOT for production use!
</template>

<script>
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'

import colors from '@/themes/default/js/color-scheme'
import { PAGE_DELETE_HAS_SUBPAGES_MSG } from '@/messages'
import { appTour } from '@/helpers/tour-manager'

import movePageMutation from 'gql/common/common-pages-mutation-move.gql'
import createFollowerMutation from 'gql/followers/create-follower.gql'
import deleteFollowerMutation from 'gql/followers/delete-follower.gql'
import isFollowingQuery from 'gql/followers/is-following.gql'
import userSettingsQuery from 'gql/user/user-query-settings.gql'
import markReleaseSeenMutation from 'gql/user/user-mutation-mark-release-seen.gql'

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
      releaseNotesDialog: false,
      releaseInfos: [],
      releaseNotesLoading: false,
      releaseNotesError: null,
      isUpgradeNotification: false,
      releaseCheckInterval: null,
      isDevMode: false,
      duplicateOpts: {
        locale: 'en',
        path: 'new-page',
        modal: false
      },
      sites: [],
      menuIsOpen: false,
      colors: colors,
      tourStepsFiltered: [] // Will be populated when tour starts
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
    RELEASE_CHECK_INTERVAL_MS() {
      return 4 * 60 * 60 * 1000 // Check every 4 hours
    },
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
      return this.hasSuperAdminPermission || this.hasSiteAdminPermission || this.sitesWithWriteAccess.includes(this.siteId)
    },
    hasSuperAdminPermission: get('page/effectivePermissions@system.manage'),
    hasSiteAdminPermission: get('page/effectivePermissions@sites.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    hasAnyPagePermissions () {
      return this.hasSuperAdminPermission || this.hasSiteAdminPermission || this.hasWritePagesPermission || this.hasManagePagesPermission ||
        this.hasDeletePagesPermission || this.hasReadSourcePermission || this.hasReadHistoryPermission
    },
    getPageActionIconColor () {
      return this.$vuetify.theme.dark ? this.colors.teal[500] : this.colors.teal[800]
    },
    trashCanColor () {
      return this.$vuetify.theme.dark ?
        this.colors.warningActionDark.secondaryDefault :
        this.colors.warningActionLight.secondaryDefault
    },
    releaseNotesCloseColor() {
      return this.$vuetify.theme.dark ?
        '#ffffff' :
        this.colors.surfaceLight.primaryBlueHeavy
    },
    tourSteps () {
      // Return filtered steps if available, otherwise return empty to prevent errors
      // Steps will be filtered when tour is actually started
      if (this.tourStepsFiltered && this.tourStepsFiltered.length > 0) {
        return this.tourStepsFiltered
      }
      // Return all steps initially (will be filtered before tour starts)
      return appTour.steps
    },
    tourCallbacks () {
      return appTour.callbacks
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
    this.startReleaseCheck()
  },
  beforeDestroy() {
    this.stopReleaseCheck()
  },
  methods: {
    startReleaseCheck() {
      // Check immediately on mount
      this.checkForNewRelease()

      // Then check periodically
      this.releaseCheckInterval = setInterval(() => {
        this.checkForNewRelease()
      }, this.RELEASE_CHECK_INTERVAL_MS)
    },
    stopReleaseCheck() {
      if (this.releaseCheckInterval) {
        clearInterval(this.releaseCheckInterval)
        this.releaseCheckInterval = null
      }
    },
    async checkForNewRelease() {
      try {
        // Only check if user is authenticated
        if (!this.isAuthenticated) return

        // Get user settings to check if release info was already seen
        let isReleaseInfoSeen = false
        try {
          const userSettingsResult = await this.$apollo.query({
            query: userSettingsQuery,
            fetchPolicy: 'network-only',
            errorPolicy: 'ignore' // Don't show error notifications
          })
          isReleaseInfoSeen = userSettingsResult.data.userSettings.isReleaseInfoSeen
        } catch (settingsErr) {
          // If user settings query fails, just continue with default (false)
          console.warn('Could not fetch user settings, continuing with default:', settingsErr)
        }

        // Get latest release version from server
        const releaseInfosQuery = await import(/* webpackChunkName: "release-infos" */ '@/graph/common/common-release-infos.gql')
        const { data } = await this.$apollo.query({
          query: releaseInfosQuery.default,
          fetchPolicy: 'network-only',
          notifyOnNetworkStatusChange: true
        })

        const releases = data.releaseInfos || []
        if (releases.length === 0) return

        // Get the latest release version from database
        const latestRelease = releases[0]
        const releaseVersionDb = latestRelease.versionNumber

        // Get last seen version from localStorage
        const releaseVersionLocalStorage = localStorage.getItem('release-version-local-storage')

        // Check conditions:
        // 1. Release version in DB is different from localStorage
        // 2. AND is_release_info_seen flag is false
        if (releaseVersionLocalStorage !== releaseVersionDb && !isReleaseInfoSeen) {
          // New release detected and not yet seen!
          
          // Update localStorage IMMEDIATELY (before opening dialog)
          localStorage.setItem('release-version-local-storage', releaseVersionDb)
          
          this.isUpgradeNotification = true
          
          // Store the release infos for display
          this.releaseInfos = releases.map(ri => ({
            versionNumber: ri.versionNumber,
            releaseDate: ri.releaseDate,
            notes: ri.notes || []
          }))

          // Auto-open dialog
          await this.$nextTick()
          this.releaseNotesDialog = true
        }
      } catch (err) {
        console.error('Error checking for new release:', err)
      }
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
    async pageDelete () {
      // Check for subpages before allowing deletion
      if (this.$store.get('page/hasChildren')) {
        // Show notification instead of delete dialog
        this.$store.commit('showNotification', {
          style: 'red',
          message: PAGE_DELETE_HAS_SUBPAGES_MSG,
          icon: 'warning',
          close: true
        })
        return
      }
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
    },
    async openReleaseNotes() {
      this.releaseNotesDialog = true
      // When manually opened, set this to false (not an auto-notification)
      this.isUpgradeNotification = false
      
      // If we already have release infos from polling, no need to fetch again
      if (this.releaseInfos.length > 0) {
        return
      }
      // Otherwise, fetch them (e.g., when user manually opens the dialog)
      this.releaseNotesLoading = true
      this.releaseNotesError = null
      try {
        const releaseInfosQuery = await import(/* webpackChunkName: \"release-infos\" */ '@/graph/common/common-release-infos.gql')
        const { data } = await this.$apollo.query({
          query: releaseInfosQuery.default,
          fetchPolicy: 'network-only'
        })
        this.releaseInfos = (data.releaseInfos || []).map(ri => ({
          versionNumber: ri.versionNumber,
          releaseDate: ri.releaseDate,
          notes: ri.notes || []
        }))
      } catch (err) {
        this.releaseNotesError = err.message || 'Failed to load release notes.'
      } finally {
        this.releaseNotesLoading = false
      }
    },
    async closeReleaseNotes() {
      this.releaseNotesDialog = false

      // Only mark as seen in database if this was an auto-upgrade notification
      if (this.isUpgradeNotification && this.releaseInfos.length > 0) {
        const latestVersion = this.releaseInfos[0].versionNumber
        
        // Update database flag
        try {
          await this.$apollo.mutate({
            mutation: markReleaseSeenMutation
          })
          
          console.log(`Marked release ${latestVersion} as seen in database`)
        } catch (err) {
          console.error('Error marking release as seen:', err)
        }
        
        this.isUpgradeNotification = false
      }
    },
    localizeReleaseNote(note) {
      const lang = (this.$i18n.locale || 'en').toLowerCase()
      if (lang.startsWith('de')) { return note.notesDe }
      return note.notesEn
    },
    formatReleaseDate(dateStr) {
      if (!dateStr) { return '' }
      try {
        const dt = new Date(dateStr)
        return dt.toLocaleDateString(this.$i18n.locale || 'en', { year: 'numeric', month: 'short', day: '2-digit' })
      } catch (e) {
        return dateStr
      }
    },
    goToRepo () {
      window.open('https://github.com/mar-team/wiki', '_blank', 'noopener')
    },
    handleProfileExit() {
      // Emit event for profile component to handle exit logic
      this.$root.$emit('profile-exit')
    },
    startTour () {
      // Filter steps based on current DOM before starting tour
      this.tourStepsFiltered = appTour.getAvailableSteps()
      
      if (this.tourStepsFiltered.length === 0) {
        this.$store.commit('showNotification', {
          style: 'orange',
          message: 'No tour steps available for your current permissions.',
          icon: 'information'
        })
        return
      }
      
      // Start tour with filtered steps
      this.$tourManager.startAppTour()
    }
  }
}
</script>

<style lang='scss' scoped>
.nav-header {
  height: 64px !important;

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

.hover-text {
  color: mc("text-dark", "primary") !important;

  &::before {
    background-color: mc("surface-dark", "primary-blue-lite");
  }

  &:hover > .v-btn__content > span {
    color: mc("action-light", "highlight-on-lite");
  }
}

.hover-icon {
  &.v-btn:hover::before {
    opacity: 0;
  }

  &:hover > .v-btn__content > .v-icon {
    color: mc("action-light", "highlight-on-lite") !important;
  }
}

.dropdown-list.v-list {
  background-color: mc("surface-light", "primary-neutral-lite") !important;

  &> .v-list-item > .v-list-item__title {
    color: mc("text-light", "primary");

    &:hover {
      color: mc("action-light", "primary-hover-on-lite");
    }
  }

  &> #selected-site-item > div {
    font-weight: 500;
    font-size: .925rem !important;
    color: mc("text-light", "black");
    &:hover {
      color: mc("action-light", "primary-hover-on-lite");
    }
  }

  &.color-theme-dark {
    background-color: mc("surface-dark", "primary-blue-lite") !important;

    &> .v-list-item > .v-list-item__title {
      color: mc("text-dark", "primary");
      &:hover {
      color: mc("action-dark", "primary-hover-on-lite");
      }
    }

    &> #selected-site-item > div {
      color: mc("text-dark", "white");
      &:hover {
        color: mc("action-dark", "primary-hover-on-lite");
      }
    }
  }
}

::v-deep .mobile-search-field {
  width: 100%;
  background-color: mc('surface-light', 'inverse');
  border-radius: 4px;
  font-size: 14px;

  &.v-input--is-focused .v-input__icon--prepend-inner > .v-icon {
    color: mc('action-light', 'highlight-on-lite') !important;
  }

  .v-text-field__slot > input {
    color: mc('text-dark', 'primary');
  }

  .v-icon.mdi.mdi-magnify {
    color: mc('text-dark', 'primary');
  }

  label.v-label.theme--light {
    color: mc('text-dark', 'primary') !important;
  }
}

@media (min-width: 960px) {
  ::v-deep .search-field {
    &.v-input > .v-input__control > .v-input__slot > .v-text-field__slot > input,
    &.v-input textarea,
    .v-label {
      color: mc('text-light', 'primary') !important;
      caret-color: mc('text-light', 'primary') !important;
    }

    &.v-input:hover{
      .v-label {
        font-size: 17px;
      }
    }

    .v-text-field__slot + .v-input__append-inner {
      background-color: mc('action-light', 'highlight-on-lite');
      border-radius: 100%;
      padding: 15px;
      margin-right: -23px;

      &> .v-input__icon > .v-icon.mdi.mdi-magnify {
        color: mc('text-light', 'primary') !important;
      }
    }

    &.v-input--is-focused .v-input__append-inner > .v-input__icon > .v-icon.mdi.mdi-magnify {
      color: mc('text-dark', 'primary') !important;
    }
  }
}

.theme--light.v-list {
  background-color: mc('surface-light', 'primary-neutral-lite');

  .v-list-item__title {
    color: mc('text-light', 'primary');

    &:hover {
      color: mc("action-light", "primary-hover-on-lite");
    }
  }
}

.theme--dark.v-list {
  background-color: mc('surface-dark', 'primary-neutral-lite');

  .v-list-item__title{
    color: mc('text-dark', 'primary');

    &:hover {
      color: mc("action-dark", "primary-hover-on-lite");
    }
  }
}

.v-tooltip__content {
  border-radius: 16px;
}

// Release Notes Dialog Styles
.release-notes-list {
  list-style-position: inside !important;
  text-align: left !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
  li {
    list-style: disc;
    margin-bottom: 4px;
    font-family: 'Ubuntu', sans-serif;
    font-weight: 500;
    font-size: 1.125rem;
    text-align: left !important;
  }
}

.release-info-block {
  .body-1 {
    font-family: 'Ubuntu', sans-serif;
    font-weight: 700;
    font-size: 1.25rem;
  }
}

.release-info-block:first-child {
  margin-top: 0;
}

.theme--light .release-info-block .body-1 {
  color: #565862;
}
.theme--light .release-notes-list li {
  color: #565862;
}

.theme--dark .release-info-block .body-1 {
  color: #c7c8cc;
}
.theme--dark .release-notes-list li {
  color: #565862;
}

.v-btn.rounded-button {
  border-radius: 20px;
}

.v-dialog {
  .v-card {
    .v-card__text {
      padding-top: 24px !important;
      padding-bottom: 8px !important;
    }
    .v-card__actions {
      padding-top: 8px !important;
      padding-bottom: 16px !important;
    }
  }
}

.theme--dark .v-dialog .v-card {
  background-color: #1d1f29 !important;
  
  .v-card__actions {
    background-color: #272936 !important;
  }
}

.theme--light .v-dialog .v-card {
  .v-card__actions {
    background-color: #e0e0e0 !important;
  }
}

.v-dialog .v-btn.rounded-button {
  font-size: 1rem !important;
  padding: 8px 24px !important;
  height: 40px !important;
  font-weight: normal !important;
  text-transform: none !important;
}

.theme--dark .v-dialog .v-btn.rounded-button {
  color: #272936 !important;
}
</style>
