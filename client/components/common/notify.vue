<template lang='pug'>
  v-snackbar.nav-notify(
    :color='$vuetify.theme.dark ? getDarkColor() : getColor()'
    top
    multi-line
    v-model='notificationState'
    :timeout='6000'
    )
    .text-left
      v-icon.mr-3(dark) mdi-{{ notification.icon }}
      span {{ notification.message }}
</template>

<script>
import { get, sync } from 'vuex-pathify'
import colors from '@/themes/default/js/extended-color-scheme'

export default {
  data() {
    return { colors: colors }
  },
  computed: {
    notification: get('notification'),
    notificationState: sync('notification@isActive')
  },
  methods: {
    getColor(){
      let color = this.notification.style;
      switch(color){
        case 'success':
        case 'green':
          return colors.alert.success;
        case 'error':
        case 'red':
          return colors.alert.error;
        case 'warning':
          return colors.alert.warning;
        case 'info':
          return colors.alert.info;
        default:
          return color;
      }
    },
    getDarkColor(){
      let color = this.notification.style;
      switch(color){
        case 'success':
        case 'green':
          return colors.alert.successOnDark;
        case 'error':
        case 'red':
          return colors.alert.errorOnDark;
        case 'warning':
          return colors.alert.warning;
        case 'info':
          return colors.alert.infoOnDark;
        default:
          return color;
      }
    }
  }
}
</script>

<style lang='scss'>
.nav-notify {
  top: -64px;
  padding-top: 0;
  z-index: 999;

  .v-snack__wrapper {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    position: relative;
    margin-top: 0;

    &::after {
      content: '';
      display: block;
      width: 100%;
      height: 2px;
      background-color: rgba(255,255,255,.4);
      position: absolute;
      bottom: 0;
      left: 0;
      animation: nav-notify-anim 6s linear;
    }
  }
}

@keyframes nav-notify-anim {
  0% {
    width: 100%;
  }
  100% {
    width: 0%;
  }
}
</style>
