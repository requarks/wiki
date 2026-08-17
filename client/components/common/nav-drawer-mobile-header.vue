<template lang='pug'>
  .nav-drawer-mobile-header
    .nav-drawer-mobile-header__profile(v-if='isAuthenticated', role='button', tabindex='0', @click='goToProfile', @keyup.enter='goToProfile')
      v-avatar.mr-3(size='48', :color='userPicture.kind === `initials` ? `blue` : ``')
        span.white--text.subheading(v-if='userPicture.kind === `initials`') {{ userPicture.initials }}
        v-img(v-else-if='userPicture.kind === `image`', :src='userPicture.url')
      div
        .subtitle-1.font-weight-medium.nav-drawer-mobile-header__name {{ userName }}
        .caption.nav-drawer-mobile-header__email {{ userEmail }}
    v-list.nav-drawer-mobile-header__links(dense)
      v-list-item(v-if='isAuthenticated', @click='logout')
        v-list-item-icon: v-icon mdi-logout
        v-list-item-title {{$t('common:header.logout')}}
      v-list-item(v-else, href='/login', @click='onNavigate')
        v-list-item-icon: v-icon mdi-login
        v-list-item-title {{$t('common:header.login')}}
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
.nav-drawer-mobile-header {
  flex: 0 0 auto;
  padding: 16px 16px 8px;

  &__profile {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    cursor: pointer;
    border-radius: 4px;
    padding: 4px;
    outline: none;

    &:hover,
    &:focus {
      background-color: rgba(0, 0, 0, 0.04);
    }
  }

  &__links .v-list-item__icon {
    margin-right: 16px;
  }

  &__email {
    font-size: 0.6875rem;
    line-height: 1.1rem;
  }
}

#root .v-application .v-navigation-drawer .v-navigation-drawer__content {
  .nav-drawer-mobile-header .caption.nav-drawer-mobile-header__email {
    font-size: 0.6875rem !important;
    line-height: 1.1rem !important;
  }
}

.nav-drawer-shell.primary .nav-drawer-mobile-header {
  background-color: mc('grey', '100');
  border-bottom: 1px solid mc('grey', '300');

  &__name {
    color: mc('grey', '900');
  }

  &__email {
    color: mc('grey', '600');
  }

  &__profile:hover,
  &__profile:focus {
    background-color: rgba(0, 0, 0, 0.05);
  }
}

.nav-drawer-shell.blue.darken-4 .nav-drawer-mobile-header {
  background-color: mc('grey', '800');
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  &__name {
    color: #fff;
  }

  &__email {
    color: mc('grey', '400');
  }

  &__profile:hover,
  &__profile:focus {
    background-color: rgba(255, 255, 255, 0.08);
  }
}
</style>
