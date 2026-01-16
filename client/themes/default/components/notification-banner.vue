<template lang="pug">
  div.notification-banners-container
    v-slide-y-transition(group, tag='div')
      v-banner.notification-banner(
        v-for='banner in activeBanners'
        :key='banner.id'
        v-if='!isDismissed(banner.id)'
        :color='getBannerColor(banner.urgency)'
        :dark='getBannerDark(banner.urgency)'
        :class='getBannerClass(banner.urgency)'
        elevation='0'
        sticky
        )
        template(v-slot:icon)
          v-icon(:color='getIconColor(banner.urgency)') {{ getBannerIcon(banner.urgency) }}
        
        .notification-banner-content
          .notification-banner-text {{ banner.text }}
        
        template(v-slot:actions)
          v-btn(
            text
            small
            @click='dismissBanner(banner.id)'
            :color='getIconColor(banner.urgency)'
            )
            v-icon(small) mdi-close
</template>

<script>
import { get } from 'vuex-pathify'
import colors from '@/themes/default/js/color-scheme'
import gql from 'graphql-tag'

export default {
  name: 'NotificationBanner',
  data() {
    return {
      colors: colors,
      dismissedBanners: []
    }
  },
  computed: {
    activeBanners() {
      // Get all banners from store
      const banners = this.$store.state?.site?.notificationBanner || []
      if (!Array.isArray(banners)) return []
      
      // Filter by active date range and not dismissed
      return banners.filter(banner => {
        if (!this.isBannerActive(banner)) return false
        if (this.dismissedBanners.includes(banner.id)) return false
        return true
      })
    }
  },
  methods: {
    isDismissed(bannerId) {
      return this.dismissedBanners.includes(bannerId)
    },
    getBannerColor(urgency) {
      switch (urgency) {
        case 'error':
          return this.$vuetify.theme.dark ? colors.surfaceDark.negative : colors.surfaceLight.negative
        case 'success':
          return this.$vuetify.theme.dark ? colors.surfaceDark.positive : colors.surfaceLight.positive
        case 'info':
        default:
          return this.$vuetify.theme.dark ? colors.surfaceDark.primaryBlueLite : colors.surfaceLight.primaryBlueLite
      }
    },
    getBannerDark(urgency) {
      return this.$vuetify.theme.dark
    },
    getBannerIcon(urgency) {
      switch (urgency) {
        case 'error':
          return 'mdi-alert-circle'
        case 'success':
          return 'mdi-check-circle'
        case 'info':
        default:
          return 'mdi-information'
      }
    },
    getIconColor(urgency) {
      switch (urgency) {
        case 'error':
          return this.$vuetify.theme.dark ? colors.red[400] : colors.red[600]
        case 'success':
          return this.$vuetify.theme.dark ? colors.green[400] : colors.green[600]
        case 'info':
        default:
          return this.$vuetify.theme.dark ? colors.blue[400] : colors.blue[500]
      }
    },
    getBannerClass(urgency) {
      return `notification-banner--${urgency || 'info'}`
    },
    isBannerActive(banner) {
      if (!banner || !banner.isActive) return false
      
      const now = new Date()
      const startDate = banner.startDate ? new Date(banner.startDate) : null
      const endDate = banner.endDate ? new Date(banner.endDate) : null
      
      if (startDate && now < startDate) return false
      if (endDate && now > endDate) return false
      
      return true
    },
    async loadActiveBanner() {
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query {
              notificationBanners {
                active {
                  id
                  text
                  urgency
                  startDate
                  endDate
                  isActive
                }
              }
            }
          `,
          fetchPolicy: 'network-only'
        })
        
        const banner = resp.data.notificationBanners.active
        if (banner) {
          this.$store.commit('site/SET_NOTIFICATION_BANNER', banner)
        }
      } catch (err) {
        console.warn('Failed to load active banner', err)
      }
    },
    dismissBanner(bannerId) {
      if (!bannerId) return
      
      // Store in localStorage
      try {
        const stored = localStorage.getItem('wiki-dismissed-banners')
        const dismissed = stored ? JSON.parse(stored) : []
        if (!dismissed.includes(bannerId)) {
          dismissed.push(bannerId)
          localStorage.setItem('wiki-dismissed-banners', JSON.stringify(dismissed))
        }
        // Update local array to trigger reactivity
        this.dismissedBanners = dismissed
      } catch (e) {
        console.warn('Failed to save dismissed banner to localStorage', e)
      }
    },
    loadDismissedBanners() {
      try {
        const stored = localStorage.getItem('wiki-dismissed-banners')
        if (stored) {
          this.dismissedBanners = JSON.parse(stored)
        }
      } catch (e) {
        console.warn('Failed to load dismissed banners from localStorage', e)
      }
    }
  },
  mounted() {
    this.loadDismissedBanners()
    this.loadActiveBanner()
  }
}
</script>

<style lang="scss" scoped>
.notification-banner {
  width: 100%;
  border-radius: 0 !important;
  border-bottom: 1px solid;
  border-bottom-color: mc('border-light', 'primary');
  
  @at-root .theme--dark & {
    border-bottom-color: mc('border-dark', 'primary');
  }
  
  ::v-deep .v-banner__wrapper {
    padding: 12px 16px;
    
    @media (max-width: 600px) {
      padding: 8px 12px;
    }
  }
  
  ::v-deep .v-banner__content {
    flex: 1;
    padding: 0 16px;
    
    @media (max-width: 600px) {
      padding: 0 8px;
    }
  }
  
  ::v-deep .v-banner__actions {
    margin: 0;
    
    .v-btn:not(.v-btn--round).v-size--small {
      height: 39px;
    }
  }
}

.notification-banner-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.notification-banner-text {
  font-size: 14px;
  line-height: 1.5;
  
  @media (max-width: 600px) {
    font-size: 13px;
  }
}

// Urgency level specific styles with zodiac colors
.notification-banner--error {
  ::v-deep .v-banner__wrapper {
    border-left: 4px solid;
    border-left-color: mc('red', '600');
  }
}

.notification-banner--success {
  ::v-deep .v-banner__wrapper {
    border-left: 4px solid;
    border-left-color: mc('green', '600');
  }
}

.notification-banner--info {
  ::v-deep .v-banner__wrapper {
    border-left: 4px solid;
    border-left-color: mc('blue', '500');
  }
}
</style>
