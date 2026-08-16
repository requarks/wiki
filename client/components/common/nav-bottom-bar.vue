<template lang='pug'>
  .nav-bottom-bar(:class='$vuetify.theme.dark ? `nav-bottom-bar--dark` : ``')
    .nav-bottom-bar__items
      //- Shared
      .nav-bottom-bar__item
        v-btn.nav-bottom-bar__btn(icon, @click='goBack', :aria-label='$t(`newpage.goback`)')
          v-icon(color='white') mdi-arrow-left

      .nav-bottom-bar__item
        v-btn.nav-bottom-bar__btn(icon, @click='goHome', :aria-label='$t(`common:header.home`)')
          v-icon(color='white') mdi-home

      .nav-bottom-bar__item
        v-btn.nav-bottom-bar__btn(icon, @click='copyPageContent', aria-label='Copy content')
          v-icon(color='white') mdi-content-copy

      .nav-bottom-bar__item
        v-btn.nav-bottom-bar__btn(icon, @click='copyPageUrl', aria-label='Copy URL')
          v-icon(color='white') mdi-link-variant

      //- Guest bar
      template(v-if='!isAuthenticated')
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

      //- Logged-in bar
      template(v-else)
        .nav-bottom-bar__item
          v-menu(offset-y, top, transition='slide-y-transition', min-width='220px')
            template(v-slot:activator='{ on, attrs }')
              v-btn.nav-bottom-bar__btn(icon, data-auth-required, v-bind='attrs', v-on='on', aria-label='Page')
                v-icon(color='white') mdi-file-document-outline
            v-list(nav, :light='!$vuetify.theme.dark', :dark='$vuetify.theme.dark', :class='$vuetify.theme.dark ? `grey darken-4` : ``')
              .overline.pa-4.grey--text Page
              v-list-item.pl-4(@click='pageNew', v-if='hasNewPagePermission')
                v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-plus-box-outline
                v-list-item-title.body-2 {{$t('common:header.newPage')}}
              v-list-item.pl-4(@click='pageEdit', v-if='canEditCurrentPage')
                v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-file-document-edit-outline
                v-list-item-title.body-2 {{$t('common:header.edit')}}
              v-list-item.pl-4(@click='viewAdminPage', v-if='isAdminArea && adminPageContext')
                v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-file-document-outline
                v-list-item-title.body-2 {{$t('common:header.view')}}
              v-list-item.pl-4(@click='openSearch')
                v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-magnify
                v-list-item-title.body-2 {{$t('common:header.search')}}

        .nav-bottom-bar__item
          v-btn.nav-bottom-bar__btn(icon, data-auth-required, @click='goToAdminSettings', :aria-label='$t(`common:header.admin`)')
            v-icon(color='white') mdi-cog
</template>

<script>
import { get } from 'vuex-pathify'
import _ from 'lodash'
import { getJwtGlobalPermissions, hasJwtAdminAccess } from '../../helpers/auth-session'

/* global siteLangs, siteConfig */

export default {
  data () {
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
    jwtGlobalPermissions () {
      return getJwtGlobalPermissions()
    },
    hasAdminAccess () {
      if (!this.isAuthenticated) {
        return false
      }
      return hasJwtAdminAccess()
    },
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasAdminPermission: get('page/effectivePermissions@system.manage'),
    hasWritePagesPermissionEffective () {
      if (!this.isAuthenticated) {
        return false
      }
      return this.hasWritePagesPermission ||
        _.intersection(this.jwtGlobalPermissions, ['write:pages', 'manage:pages']).length > 0 ||
        this.hasAdminAccess
    },
    hasAdminPermissionEffective () {
      if (!this.isAuthenticated) {
        return false
      }
      return this.hasAdminPermission || this.hasAdminAccess
    },
    hasNewPagePermission () {
      if (!this.isAuthenticated) {
        return false
      }
      return this.hasAdminPermissionEffective ||
        _.intersection(this.jwtGlobalPermissions, ['write:pages', 'manage:pages']).length > 0 ||
        _.intersection(this.permissions, ['write:pages', 'manage:pages']).length > 0
    },
    canEditCurrentPage () {
      return !this.isAdminArea && !!this.wikiPath && this.mode === 'view' && this.hasWritePagesPermissionEffective
    },
    pageUrl () {
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
    pageEdit () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageEdit')
    },
    viewAdminPage () {
      if (!this.adminPageContext) { return }
      window.location.assign(`/${this.adminPageContext.locale}/${this.adminPageContext.path}`)
    },
    openSearch () {
      this.$root.$emit('focusMobileSearch')
    },
    getPageContentText () {
      const contentsEl = document.querySelector('.v-main .contents')
      if (!contentsEl) {
        return ''
      }
      return (contentsEl.innerText || contentsEl.textContent || '').trim()
    },
    async copyTextToClipboard (text, successMessage) {
      if (!text) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'Nothing to copy',
          icon: 'alert'
        })
        return
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = text
          textarea.setAttribute('readonly', '')
          textarea.style.position = 'absolute'
          textarea.style.left = '-9999px'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }

        this.$store.commit('showNotification', {
          style: 'success',
          message: successMessage,
          icon: 'content-copy'
        })
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'Failed to copy to clipboard',
          icon: 'alert'
        })
      }
    },
    copyPageContent () {
      this.copyTextToClipboard(this.getPageContentText(), 'Content copied successfully')
    },
    copyPageUrl () {
      this.copyTextToClipboard(this.pageUrl, 'URL copied successfully')
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
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.pageUrl)}&title=${encodeURIComponent(this.shareTitle)}&description=${encodeURIComponent(this.shareDescription)}`
      )
    },
    shareWhatsapp () {
      this.openSocialPop(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(this.shareTitle)}%0D%0A${encodeURIComponent(this.pageUrl)}`
      )
    },
    isMobileShareDevice () {
      return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    },
    facebookAppId () {
      return _.get(siteConfig, 'facebookAppId', '') || ''
    },
    shareMessenger () {
      const link = encodeURIComponent(this.pageUrl)
      const appId = this.facebookAppId()
      const appIdQuery = appId ? `&app_id=${encodeURIComponent(appId)}` : ''

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
    padding: 0 4px;
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
    width: 44px !important;
    min-width: 44px !important;
    max-width: 44px;
    height: 44px !important;
    margin: 0 !important;
    padding: 0 !important;
    color: #fff !important;

    .v-icon {
      color: #fff !important;
      font-size: 21px !important;
    }

    &.v-btn--disabled .v-icon {
      color: rgba(255, 255, 255, 0.38) !important;
    }
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
