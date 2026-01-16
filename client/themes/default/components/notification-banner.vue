<template lang="pug">
  v-slide-y-transition
    v-banner.notification-banner(
      v-if='activeBanner && !isDismissed'
      :color='bannerColor'
      :dark='bannerDark'
      :icon='bannerIcon'
      :class='bannerClass'
      elevation='0'
      sticky
      )
      template(v-slot:icon)
        v-icon(:color='iconColor') {{ bannerIcon }}
      
      .notification-banner-content
        .notification-banner-text {{ activeBanner.text }}
      
      template(v-slot:actions)
        v-btn(
          text
          small
          @click='dismissBanner'
          :color='iconColor'
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
      isDismissed: false,
      dismissedBanners: []
    }
  },
  computed: {
    activeBanner() {
      // This will be populated from the store/API
      const banner = this.$store.state?.site?.notificationBanner || null
      if (!banner) return null
      
      // Check if banner is within active date range
      if (!this.isBannerActive(banner)) return null
      
      // Check if user has dismissed this banner
      if (this.dismissedBanners.includes(banner.id)) return null
      
      return banner
    },
    bannerColor() {
      if (!this.activeBanner) return ''
      
      switch (this.activeBanner.urgency) {
        case 'error':
          return this.$vuetify.theme.dark ? colors.surfaceDark.negative : colors.surfaceLight.negative
        case 'success':
          return this.$vuetify.theme.dark ? colors.surfaceDark.positive : colors.surfaceLight.positive
        case 'info':
        default:
          return this.$vuetify.theme.dark ? colors.surfaceDark.primaryBlueLite : colors.surfaceLight.primaryBlueLite
      }
    },
    bannerDark() {
      if (!this.activeBanner) return false
      return this.$vuetify.theme.dark
    },
    bannerIcon() {
      if (!this.activeBanner) return 'mdi-information'
      
      if (this.activeBanner.icon) {
        return this.activeBanner.icon
      }
      
      switch (this.activeBanner.urgency) {
        case 'error':
        case 'critical':
          return 'mdi-alert-circle'

        case 'success':
          return 'mdi-check-circle'
        case 'info':
        default:
          return 'mdi-information'
      }
    },
    iconColor() {
      if (!this.activeBanner) return ''
      
      switch (this.activeBanner.urgency) {
        case 'error':
          return this.$vuetify.theme.dark ? colors.red[400] : colors.red[600]
        case 'success':
          return this.$vuetify.theme.dark ? colors.green[400] : colors.green[600]
        case 'info':
        default:
          return this.$vuetify.theme.dark ? colors.blue[400] : colors.blue[500]
      }
    },
    bannerClass() {
      if (!this.activeBanner) return ''
      return `notification-banner--${this.activeBanner.urgency || 'info'}`
    }
  },
  methods: {
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
    dismissBanner() {
      if (!this.activeBanner) return
      
      // Store in localStorage
      try {
        const stored = localStorage.getItem('wiki-dismissed-banners')
        const dismissed = stored ? JSON.parse(stored) : []
        if (!dismissed.includes(this.activeBanner.id)) {
          dismissed.push(this.activeBanner.id)
          localStorage.setItem('wiki-dismissed-banners', JSON.stringify(dismissed))
        }
        // Update local array to trigger reactivity
        this.dismissedBanners = dismissed
      } catch (e) {
        console.warn('Failed to save dismissed banner to localStorage', e)
      }
      
      this.isDismissed = true
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
