<template lang='pug'>
  .nav-drawer-mobile-header
    .nav-drawer-mobile-header__profile(v-if='isAuthenticated', role='button', tabindex='0', @click='goToProfile', @keyup.enter='goToProfile')
      v-avatar.mr-3(size='48', :color='userPicture.kind === `initials` ? `blue` : ``')
        span.white--text.subheading(v-if='userPicture.kind === `initials`') {{ userPicture.initials }}
        v-img(v-else-if='userPicture.kind === `image`', :src='userPicture.url')
      div
        .subtitle-1.font-weight-medium.white--text {{ userName }}
        .caption.blue-grey--text.text--lighten-3 {{ userEmail }}
    v-list.nav-drawer-mobile-header__links(dense, dark)
      v-list-item(v-if='isAuthenticated', @click='logout')
        v-list-item-icon: v-icon(color='red lighten-2') mdi-logout
        v-list-item-title.red--text.text--lighten-2 {{$t('common:header.logout')}}
      v-list-item(v-else, href='/login', @click='onNavigate')
        v-list-item-icon: v-icon mdi-login
        v-list-item-title {{$t('common:header.login')}}
</template>

<script>
import _ from 'lodash'
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
      window.location.assign('/logout')
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
      background-color: rgba(255, 255, 255, 0.08);
    }
  }

  &__links .v-list-item__icon {
    margin-right: 16px;
  }
}
</style>
