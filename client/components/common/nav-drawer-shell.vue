<template lang='pug'>
  v-navigation-drawer.nav-drawer-shell(
    v-if='visible'
    v-model='drawerModel'
    :app='true'
    fixed
    :clipped='true'
    :right='$vuetify.rtl'
    :permanent='permanent'
    :temporary='temporary'
    :width='width'
    overlay-color='black'
    :overlay-opacity='0.55'
    :mobile-breakpoint='resolvedMobileBreakpoint'
    :class='drawerClass'
    )
    nav-drawer-mobile-header(@navigate='onNavigate')
    .theme--dark.nav-drawer-shell__scroll
      vue-scroll(:ops='resolvedScrollStyle')
        slot
</template>

<script>
import NavDrawerMobileHeader from './nav-drawer-mobile-header.vue'
import { NAV_DRAWER_DESKTOP_WIDTH } from './nav-drawer-config'
import {
  SCROLLBAR_GREY_DEFAULT,
  SCROLLBAR_GREY_HOVER
} from '../../helpers/theme-colors'

export function createNavDrawerScrollStyle (rtl = false) {
  return {
    vuescroll: {},
    scrollPanel: {
      initialScrollY: 0,
      initialScrollX: 0,
      scrollingX: false,
      easing: 'easeOutQuad',
      speed: 1000,
      verticalNativeBarPos: rtl ? 'left' : 'right'
    },
    rail: {
      gutterOfEnds: '2px'
    },
    bar: {
      onlyShowBarOnScroll: false,
      background: SCROLLBAR_GREY_DEFAULT,
      hoverStyle: {
        background: SCROLLBAR_GREY_HOVER
      }
    }
  }
}

const CATEGORY_CLASS = {
  admin: 'admin-sidebar-mobile',
  tags: 'tags-sidebar-mobile',
  profile: 'profile-sidebar-mobile',
  wiki: 'nav-drawer-mobile'
}

export default {
  components: {
    NavDrawerMobileHeader
  },
  props: {
    value: {
      type: Boolean,
      default: true
    },
    visible: {
      type: Boolean,
      default: true
    },
    permanent: {
      type: Boolean,
      default: false
    },
    temporary: {
      type: Boolean,
      default: false
    },
    category: {
      type: String,
      default: 'wiki'
    },
    width: {
      type: [Number, String],
      default () {
        return NAV_DRAWER_DESKTOP_WIDTH
      }
    },
    scrollStyle: {
      type: Object,
      default: null
    },
    mobileBreakpoint: {
      type: [Number, String],
      default: 960
    }
  },
  computed: {
    drawerModel: {
      get () {
        if (this.permanent) {
          return true
        }
        return this.value
      },
      set (val) {
        if (this.permanent) {
          return
        }
        this.$emit('input', val)
      }
    },
    resolvedMobileBreakpoint () {
      return this.permanent ? 0 : this.mobileBreakpoint
    },
    drawerClass () {
      const suffix = CATEGORY_CLASS[this.category] || CATEGORY_CLASS.wiki
      return this.$vuetify.theme.dark ? `${suffix} blue darken-4` : `${suffix} primary`
    },
    resolvedScrollStyle () {
      return this.scrollStyle || createNavDrawerScrollStyle(this.$vuetify.rtl)
    }
  },
  methods: {
    onNavigate () {
      this.$emit('navigate')
    }
  }
}
</script>

<style lang='scss'>
.nav-drawer-shell {
  padding-top: 0;

  .v-navigation-drawer__content {
    height: 100%;
    max-height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  &__scroll {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .__vuescroll {
    flex: 1 1 auto;
    min-height: 0;
    height: auto !important;
    max-height: none !important;
  }

  .__panel {
    height: 100% !important;
  }
}
</style>
