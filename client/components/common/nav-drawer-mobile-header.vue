<template lang='pug'>
  .nav-drawer-mobile-header(
    :style='headerStyle'
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
        :style='avatarStyle'
      )
        span(v-if='userPicture.kind === `initials`', :style='{ color: navDrawerHeaderFg }') {{ userPicture.initials }}
        img(
          v-else-if='userPicture.kind === `image`',
          :src='userPicture.url',
          alt='',
          style='width:48px;height:48px;object-fit:cover;display:block;'
        )
      div
        div(:style='nameStyle') {{ userName }}
        div(:style='emailStyle') {{ userEmail }}
    div(style='display:flex;flex-direction:column;gap:2px;')
      button(
        v-if='isAuthenticated',
        class='nav-drawer-mobile-header__action',
        type='button',
        @click='logout',
        :style='actionStyle'
      )
        i.mdi.mdi-logout(style='font-size:20px;line-height:1;')
        span {{ $t('common:header.logout') }}
      a(
        v-else,
        class='nav-drawer-mobile-header__action',
        href='/login',
        @click='onNavigate',
        :style='actionStyle'
      )
        i.mdi.mdi-login(style='font-size:20px;line-height:1;')
        span {{ $t('common:header.login') }}
</template>

<script>
import _ from 'lodash'
import { getLogoutUrl } from '../../helpers/auth-session'
import {
  NAV_DRAWER_HEADER_FG,
  NAV_DRAWER_HEADER_FG_MUTED
} from '../../helpers/theme-colors'
import { get } from 'vuex-pathify'

export default {
  data () {
    return {
      navDrawerHeaderFg: NAV_DRAWER_HEADER_FG,
      navDrawerHeaderFgMuted: NAV_DRAWER_HEADER_FG_MUTED
    }
  },
  computed: {
    isAuthenticated: get('user/authenticated'),
    userName: get('user/name'),
    userEmail: get('user/email'),
    userPictureUrl: get('user/pictureUrl'),
    headerStyle () {
      return {
        flex: '0 0 auto',
        padding: '16px 16px 8px',
        background: '#bbdefb',
        borderBottom: '1px solid #64b5f6',
        color: NAV_DRAWER_HEADER_FG
      }
    },
    avatarStyle () {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 48px',
        minWidth: '48px',
        maxWidth: '48px',
        width: '48px',
        minHeight: '48px',
        maxHeight: '48px',
        height: '48px',
        borderRadius: '50%',
        background: '#fff',
        color: NAV_DRAWER_HEADER_FG,
        marginInlineEnd: '12px',
        overflow: 'hidden'
      }
    },
    nameStyle () {
      return {
        fontSize: '18px',
        fontWeight: '600',
        lineHeight: '1.45',
        color: NAV_DRAWER_HEADER_FG
      }
    },
    emailStyle () {
      return {
        fontSize: '15px',
        lineHeight: '1.3',
        color: NAV_DRAWER_HEADER_FG_MUTED
      }
    },
    actionStyle () {
      return {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        height: '36px',
        padding: '0 8px',
        border: '0',
        borderRadius: '8px',
        background: 'transparent',
        color: NAV_DRAWER_HEADER_FG,
        cursor: 'pointer',
        textAlign: 'left',
        textDecoration: 'none'
      }
    },
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

.nav-drawer-mobile-header__profile:active,
.nav-drawer-mobile-header__action:active {
  background-color: rgba(25, 43, 133, 0.08) !important;
  color: rgba(25, 43, 133, 0.82) !important;

  i,
  span {
    color: rgba(25, 43, 133, 0.82) !important;
  }
}
</style>
