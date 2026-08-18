<template lang='pug'>
  .nav-drawer-mobile-header(
    style="flex:0 0 auto;padding:16px 16px 8px;background:#bbdefb;border-bottom:1px solid #64b5f6;color:#192b85;"
  )
    .nav-drawer-mobile-header__profile(
      v-if='isAuthenticated',
      role='button',
      tabindex='0',
      @click='goToProfile',
      @keyup.enter='goToProfile',
      style='display:flex;align-items:center;margin-bottom:8px;padding:6px 8px;border-radius:8px;cursor:pointer;'
    )
      span(
        style='display:inline-flex;align-items:center;justify-content:center;flex:0 0 48px;min-width:48px;max-width:48px;width:48px;min-height:48px;max-height:48px;height:48px;border-radius:50%;background:#fff;color:#192b85;margin-inline-end:12px;overflow:hidden;'
      )
        span(v-if='userPicture.kind === `initials`', style='color:#192b85;') {{ userPicture.initials }}
        img(
          v-else-if='userPicture.kind === `image`',
          :src='userPicture.url',
          alt='',
          style='width:48px;height:48px;object-fit:cover;display:block;'
        )
      div
        div(style='font-size:18px;font-weight:600;line-height:1.45;color:#192b85;') {{ userName }}
        div(style='font-size:15px !important;line-height:1.3 !important;color:rgba(25,43,133,0.75);') {{ userEmail }}
    div(style='display:flex;flex-direction:column;gap:2px;')
      button(
        v-if='isAuthenticated',
        class='nav-drawer-mobile-header__action',
        type='button',
        @click='logout',
        style='display:flex;align-items:center;gap:12px;height:36px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:#192b85;cursor:pointer;text-align:left;'
      )
        i.mdi.mdi-logout(style='font-size:20px;line-height:1;')
        span {{ $t('common:header.logout') }}
      a(
        v-else,
        class='nav-drawer-mobile-header__action',
        href='/login',
        @click='onNavigate',
        style='display:flex;align-items:center;gap:12px;height:36px;padding:0 8px;border-radius:8px;color:#192b85;text-decoration:none;'
      )
        i.mdi.mdi-login(style='font-size:20px;line-height:1;')
        span {{ $t('common:header.login') }}
</template>

<script>
import _ from 'lodash'
import { getLogoutUrl } from '../../helpers/auth-session'
import { get } from 'vuex-pathify'

export default {
  computed: {
    isAuthenticated: get('user/authenticated'),
    userName: get('user/name'),
    userEmail: get('user/email'),
    userPictureUrl: get('user/pictureUrl'),
    userPicture () {
      if (this.userPictureUrl && this.userPictureUrl.length > 1) {
        return {
          kind: 'image',
          url: (this.userPictureUrl === 'internal') ? `/_userav/${this.$store.get('user/id')}` : this.userPictureUrl
        }
      }
      const nameParts = (this.userName || '').toUpperCase().split(' ')
      let initials = _.head(nameParts).charAt(0) || '?'
      if (nameParts.length > 1) {
        initials += _.last(nameParts).charAt(0)
      }
      return { kind: 'initials', initials }
    }
  },
  methods: {
    onNavigate () {
      this.$emit('navigate')
    },
    goToProfile () {
      this.$emit('navigate')
      window.location.assign('/p')
    },
    logout () {
      window.location.assign(getLogoutUrl())
    }
  }
}
</script>

<style lang='scss'>
.nav-drawer-mobile-header__profile:hover,
.nav-drawer-mobile-header__profile:focus,
.nav-drawer-mobile-header__action:hover,
.nav-drawer-mobile-header__action:focus {
  background-color: rgba(25, 43, 133, 0.05) !important;
}
</style>
