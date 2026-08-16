<template lang='pug'>
  v-navigation-drawer.nav-drawer-shell(
    v-if='visible'
    v-model='drawerModel'
    :app='true'
    fixed
    :clipped='true'
    dark
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
    vue-scroll(:ops='resolvedScrollStyle')
      slot
</template>

<script>
import NavDrawerMobileHeader from './nav-drawer-mobile-header.vue'

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
      background: '#CCC',
      hoverStyle: {
        background: '#999'
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
      default: 256
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

  .nav-drawer-mobile-header {
    flex: 0 0 auto;
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

  &.primary {
    background-color: mc('theme', 'primary') !important;
  }

  &.blue.darken-4 {
    background-color: mc('blue', '900') !important;
  }

  .v-divider {
    border-color: rgba(255, 255, 255, 0.12) !important;
  }

  .v-list-item__title,
  .v-list-item__content,
  .v-list-item__icon .v-icon:not(.red--text):not([class*='red--']),
  .v-subheader {
    color: #fff !important;
  }

  .v-list-item--active {
    background-color: rgba(255, 255, 255, 0.12) !important;
  }
}
</style>
