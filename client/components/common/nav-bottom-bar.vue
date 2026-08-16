<template lang='pug'>
  .nav-bottom-bar(:class='$vuetify.theme.dark ? `nav-bottom-bar--dark` : ``')
    .nav-bottom-bar__items
      .nav-bottom-bar__item
        v-btn.nav-bottom-bar__btn(icon, @click='goBack', :aria-label='$t(`newpage.goback`)')
          v-icon(color='white') mdi-arrow-left

      .nav-bottom-bar__item
        v-btn.nav-bottom-bar__btn(icon, @click='goHome', :aria-label='$t(`common:header.home`)')
          v-icon(color='white') mdi-home

      .nav-bottom-bar__item(v-if='showAdminSettings')
        v-btn.nav-bottom-bar__btn(icon, data-auth-required, @click='goToAdminSettings', :aria-label='$t(`common:header.admin`)')
          v-icon(color='white') mdi-cog

      .nav-bottom-bar__item
        v-menu(v-if='!isAdminArea && hasAnyPagePermissions && wikiPath && mode === `view`', offset-y, top, transition='slide-y-transition')
          template(v-slot:activator='{ on, attrs }')
            v-btn.nav-bottom-bar__btn(icon, data-auth-required, v-bind='attrs', v-on='on', :aria-label='$t(`common:header.pageActions`)')
              v-icon(color='white') mdi-file-document-edit-outline
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
        v-btn.nav-bottom-bar__btn(v-else-if='isAdminArea && adminPageContext', icon, @click='viewAdminPage', :aria-label='$t(`common:header.view`)')
          v-icon(color='white') mdi-file-document-outline
        v-btn.nav-bottom-bar__btn(v-else, icon, disabled)
          v-icon.nav-bottom-bar__icon--disabled mdi-file-document-edit-outline

      .nav-bottom-bar__item
        v-btn.nav-bottom-bar__btn(v-if='isAdminArea && isAuthenticated', icon, data-auth-required, @click='goToAdminPages', :aria-label='$t(`admin:pages.title`)')
          v-icon(color='white') mdi-file-document-multiple-outline
        v-btn.nav-bottom-bar__btn(v-else-if='hasNewPagePermission && mode !== `edit`', icon, data-auth-required, @click='pageNew', :aria-label='$t(`common:header.newPage`)')
          v-icon(color='white') mdi-plus-box-outline
        v-btn.nav-bottom-bar__btn(v-else, icon, disabled)
          v-icon.nav-bottom-bar__icon--disabled mdi-plus-box-outline

      .nav-bottom-bar__item
        v-menu(offset-y, top, transition='slide-y-transition', min-width='210px')
          template(v-slot:activator='{ on, attrs }')
            v-btn.nav-bottom-bar__btn(icon, v-bind='attrs', v-on='on', :aria-label='$t(`common:page.share`)')
              v-icon(color='white') mdi-share-variant
          v-list(nav, dense)
            v-list-item(@click='shareFacebook')
              v-icon.nav-bottom-bar__share-icon--facebook(small) mdi-facebook
              v-list-item-title.px-3 Facebook
            v-list-item(@click='shareWhatsapp')
              v-icon.nav-bottom-bar__share-icon--whatsapp(small) mdi-whatsapp
              v-list-item-title.px-3 Whatsapp
            v-list-item(@click='shareMessenger')
              v-icon.nav-bottom-bar__share-icon--messenger(small) mdi-facebook-messenger
              v-list-item-title.px-3 Messenger
</template>

<script>
import { get } from 'vuex-pathify'
import _ from 'lodash'
import jwt from 'jsonwebtoken'
import Cookies from 'js-cookie'

/* global siteLangs, siteConfig */

const ADMIN_ACCESS_PERMISSIONS = [
  'manage:system',
  'write:users',
  'manage:users',
  'write:groups',
  'manage:groups',
  'manage:navigation',
  'manage:theme',
  'manage:api'
]

export default {
  data() {
    return {
      adminPageContext: null
    }
  },
  mounted () {
    this.$root.$on('adminPageContext', this.onAdminPageContext)
  },
  beforeDestroy () {
    this.$root.$off('adminPageContext', this.onAdminPageContext)
  },
  computed: {
    isAdminArea () {
      return /^\/a(\/|$)/.test(window.location.pathname)
    },
    wikiPath: get('page/path'),
    locale: get('page/locale'),
    mode: get('page/mode'),
    pageTitle: get('page/title'),
    pageDescription: get('page/description'),
    isAuthenticated: get('user/authenticated'),
    permissions: get('user/permissions'),
    effectivePermissions () {
      if (!this.isAuthenticated) {
        return []
      }
      if (Array.isArray(this.permissions) && this.permissions.length > 0) {
        return this.permissions
      }
      const jwtCookie = Cookies.get('jwt')
      if (!jwtCookie) { return [] }
      try {
        const jwtData = jwt.decode(jwtCookie)
        return Array.isArray(jwtData.permissions) ? jwtData.permissions : []
      } catch (err) {
        return []
      }
    },
    hasAdminAccess () {
      if (!this.isAuthenticated) {
        return false
      }
      return _.intersection(this.effectivePermissions, ADMIN_ACCESS_PERMISSIONS).length > 0
    },
    showAdminSettings () {
      return this.isAuthenticated && (this.isAdminArea || this.hasAdminAccess)
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
    shareUrl () {
      if (this.adminPageContext && this.adminPageContext.locale && this.adminPageContext.path) {
        return `${window.location.origin}/${this.adminPageContext.locale}/${this.adminPageContext.path}`
      }
      if (this.wikiPath && this.locale) {
        return `${window.location.origin}/${this.locale}/${this.wikiPath}`
      }
      return window.location.href
    },
    shareTitle () {
      return this.pageTitle || document.title || 'Untitled Page'
    },
    shareDescription () {
      return this.pageDescription || ''
    }
  },
  methods: {
    requireAuth () {
      if (!this.isAuthenticated) {
        window.location.assign('/login')
        return false
      }
      return true
    },
    onAdminPageContext (ctx) {
      this.adminPageContext = ctx
    },
    goBack () {
      window.history.back()
    },
    goToAdminPages () {
      if (!this.requireAuth()) { return }
      if (this.$router) {
        this.$router.push('/pages').catch(() => {})
      } else {
        window.location.assign('/a/pages')
      }
    },
    viewAdminPage () {
      if (!this.adminPageContext) { return }
      window.location.assign(`/${this.adminPageContext.locale}/${this.adminPageContext.path}`)
    },
    getHomeLocale () {
      if (this.isAdminArea) {
        if (this.locale && siteLangs.some(lc => lc.code === this.locale)) {
          return this.locale
        }
        return siteConfig.lang
      }
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
    },
    goToAdminSettings () {
      if (!this.requireAuth()) { return }
      window.location.assign('/a')
    },
    pageNew () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageNew')
    },
    pageView () {
      if (!this.requireAuth()) { return }
      window.location.assign(`/${this.locale}/${this.wikiPath}`)
    },
    pageEdit () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageEdit')
    },
    pageHistory () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageHistory')
    },
    pageSource () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageSource')
    },
    pageConvert () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageConvert')
    },
    pageDuplicate () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageDuplicate')
    },
    pageMove () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageMove')
    },
    pageDelete () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageDelete')
    },
    openSocialPop (url) {
      const width = 626
      const height = 436
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : screen.left
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : screen.top
      const screenWidth = window.innerWidth || document.documentElement.clientWidth || screen.width
      const screenHeight = window.innerHeight || document.documentElement.clientHeight || screen.height
      const left = ((screenWidth / 2) - (width / 2)) + dualScreenLeft
      const top = ((screenHeight / 2) - (height / 2)) + dualScreenTop

      const popupWindow = window.open(
        url,
        'sharer',
        `status=no,height=${height},width=${width},resizable=yes,left=${left},top=${top},screenX=${left},screenY=${top},toolbar=no,menubar=no,scrollbars=no,location=no,directories=no`
      )

      if (popupWindow) {
        popupWindow.focus()
      }
    },
    shareFacebook () {
      this.openSocialPop(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareUrl)}&title=${encodeURIComponent(this.shareTitle)}&description=${encodeURIComponent(this.shareDescription)}`
      )
    },
    shareWhatsapp () {
      this.openSocialPop(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(this.shareTitle)}%0D%0A${encodeURIComponent(this.shareUrl)}`
      )
    },
    isMobileShareDevice () {
      return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    },
    facebookAppId () {
      return _.get(siteConfig, 'facebookAppId', '') || ''
    },
    shareMessenger () {
      const link = encodeURIComponent(this.shareUrl)
      const appId = this.facebookAppId()
      const appIdQuery = appId ? `&app_id=${encodeURIComponent(appId)}` : ''

      // Send Dialog popups are unsupported on mobile; open the native Messenger app instead.
      if (this.isMobileShareDevice()) {
        window.location.assign(`fb-messenger://share/?link=${link}${appIdQuery}`)
        return
      }

      const redirectUri = encodeURIComponent(`${window.location.origin}/`)
      if (!appId) {
        this.openSocialPop(`https://www.facebook.com/dialog/send?link=${link}&redirect_uri=${redirectUri}`)
        return
      }

      this.openSocialPop(
        `https://www.facebook.com/dialog/send?app_id=${encodeURIComponent(appId)}&link=${link}&redirect_uri=${redirectUri}`
      )
    }
  }
}
</script>

<style lang='scss'>
.nav-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 100vw;
  height: 56px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: mc('theme', 'primary');
  border-top: 1px solid rgba(255, 255, 255, 0.24);
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.12);
  z-index: 220;
  padding: 0 env(safe-area-inset-right, 0) 0 env(safe-area-inset-left, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
  overflow: visible;

  &--dark {
    background-color: mc('blue', '900');
    border-top-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.35);
  }

  &__items {
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    width: 100%;
    max-width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0 8px;
  }

  &__item {
    flex: 0 0 auto;
    display: inline-flex;
    justify-content: center;
    align-items: center;

    .v-menu {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      margin: 0;
    }
  }

  &__btn {
    flex: none;
    width: 48px !important;
    min-width: 48px !important;
    max-width: 48px;
    height: 44px !important;
    margin: 0 !important;
    padding: 0 !important;
    color: #fff !important;

    .v-icon {
      color: #fff !important;
      font-size: 22px !important;
    }

    &.v-btn--disabled .v-icon {
      color: rgba(255, 255, 255, 0.38) !important;
    }
  }

  &__icon--disabled {
    color: rgba(255, 255, 255, 0.38) !important;
  }

  &__share-icon {
    &--facebook {
      color: #1877f2 !important;
    }

    &--whatsapp {
      color: #25d366 !important;
    }

    &--messenger {
      color: #0084ff !important;
    }
  }
}
</style>
