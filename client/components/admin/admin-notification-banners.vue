<template lang="pug">
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-info.svg', alt='Notification Banners', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft Notification Banners
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s Manage site-wide announcement banners
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s(
            color='primary'
            depressed
            @click='createBanner'
            large
            )
            v-icon(left) mdi-plus
            span New Banner
        
        v-card.mt-3.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title.subtitle-1 Banners List
          v-card-text
            v-data-table(
              :headers='headers'
              :items='banners'
              :loading='loading'
              :items-per-page='15'
              hide-default-footer
              )
              template(v-slot:item.urgency='{ item }')
                v-chip(
                  :color='getUrgencyColor(item.urgency)'
                  small
                  dark
                  ) {{ item.urgency.toUpperCase() }}
              
              template(v-slot:item.text='{ item }')
                .text-truncate(style='max-width: 400px;') {{ item.text }}
              
              template(v-slot:item.dates='{ item }')
                .caption
                  div(v-if='item.startDate') Start: {{ formatDate(item.startDate) }}
                  div(v-if='item.endDate') End: {{ formatDate(item.endDate) }}
                  div(v-else-if='!item.startDate && !item.endDate') Always Active
              
              template(v-slot:item.isActive='{ item }')
                v-switch(
                  v-model='item.isActive'
                  @change='toggleActiveBanner(item)'
                  color='primary'
                  hide-details
                  )
              
              template(v-slot:item.actions='{ item }')
                v-btn(icon, small, @click='editBanner(item)')
                  v-icon(color='primary', small) mdi-pencil
                v-btn(icon, small, @click='deleteBannerDialog(item)')
                  v-icon(color='red', small) mdi-delete
    //- Create/Edit Dialog
    v-dialog(
      v-model='dialog'
      max-width='800'
      persistent
      overlay-color='blue-grey darken-4'
      overlay-opacity='.7'
      )
      v-card
        .dialog-header.is-short(:style='`background-color: ${colors.blue[500]} !important;`')
          v-icon.mr-2(color='white') mdi-information-outline
          span(:style='`color: ${colors.textLight.inverse};`') {{ editMode ? 'Edit Notification Banner' : 'Create Notification Banner' }}
        v-card-text.pt-5
          v-form(ref='form', v-model='valid')
            v-textarea(
              v-model='currentBanner.text'
              label='Banner Text'
              placeholder='Enter announcement or notification text...'
              :rules='[rules.required, rules.maxLength]'
              counter='500'
              outlined
              dense
              rows='3'
              )
            
            v-select(
              v-model='currentBanner.urgency'
              :items='urgencyLevels'
              label='Urgency Level'
              :rules='[rules.required]'
              outlined
              dense
              hide-details
              )
              template(v-slot:item='{ item }')
                v-chip(:color='getUrgencyColor(item.value)', small, dark) {{ item.text }}
            
            v-row.mt-5
              v-col(cols='12', md='6')
                v-menu(
                  ref='startDateMenu'
                  v-model='startDateMenu'
                  :close-on-content-click='false'
                  transition='scale-transition'
                  offset-y
                  min-width='290px'
                  )
                  template(v-slot:activator='{ on, attrs }')
                    v-text-field(
                      v-model='currentBanner.startDate'
                      label='Start Date (optional)'
                      prepend-icon='mdi-calendar'
                      readonly
                      v-bind='attrs'
                      v-on='on'
                      clearable
                      outlined
                      dense
                      hide-details
                      )
                  v-date-picker(
                    v-model='currentBanner.startDate'
                    @input='startDateMenu = false'
                    )
              
              v-col(cols='12', md='6')
                v-menu(
                  ref='endDateMenu'
                  v-model='endDateMenu'
                  :close-on-content-click='false'
                  transition='scale-transition'
                  offset-y
                  min-width='290px'
                  )
                  template(v-slot:activator='{ on, attrs }')
                    v-text-field(
                      v-model='currentBanner.endDate'
                      label='End Date (optional)'
                      prepend-icon='mdi-calendar'
                      readonly
                      v-bind='attrs'
                      v-on='on'
                      clearable
                      outlined
                      dense
                      hide-details
                      )
                  v-date-picker(
                    v-model='currentBanner.endDate'
                    @input='endDateMenu = false'
                    :min='currentBanner.startDate'
                    )
            
            v-switch(
              v-model='currentBanner.isActive'
              label='Active'
              color='primary'
              )
        
        v-card-chin
          v-spacer
          v-btn.btn-rounded(
            outlined
            rounded
            :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
            @click='closeDialog'
            :disabled='saving'
            ) {{$t('common:actions.cancel')}}
          v-btn.px-4.btn-rounded(
            rounded
            dark
            :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
            @click='saveBanner'
            :disabled='!valid'
            :loading='saving'
            )
            span.text-none {{ editMode ? 'UPDATE' : 'CREATE' }}

    //- Delete Confirmation Dialog
    v-dialog(
      v-model='deleteDialog'
      max-width='550'
      )
      v-card
        .dialog-header.is-short(:style='`background-color: ${colors.blue[500]} !important;`')
          v-icon.mr-2(color='white') mdi-alert
          span(:style='`color: ${colors.textLight.inverse};`') {{$t('common:actions.delete')}}
        v-card-text.pt-4
          .body-2(:style='`color: ${$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary};`') Are you sure you want to delete this notification banner?
        v-card-chin
          v-spacer
          v-btn.btn-rounded(
            outlined
            rounded
            :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
            @click='deleteDialog = false'
            )
            span.text-none.text-uppercase {{$t('common:actions.cancel')}}
          v-btn.btn-rounded(
            rounded
            dark
            :color='colors.red[450]'
            @click='confirmDelete'
            :loading='deleting'
            )
            v-icon(left, color='white') mdi-delete-forever
            span.text-none.text-uppercase(:style='`color: ${colors.textLight.inverse};`') {{$t('common:actions.delete')}}
</template>

<script>
import { get, sync } from 'vuex-pathify'
import colors from '@/themes/default/js/color-scheme'
import gql from 'graphql-tag'

export default {
  data() {
    return {
      colors: colors,
      loading: false,
      saving: false,
      deleting: false,
      dialog: false,
      deleteDialog: false,
      editMode: false,
      valid: false,
      startDateMenu: false,
      endDateMenu: false,
      banners: [],
      currentBanner: null,
      bannerToDelete: null,
      nextId: 3,
      headers: [
        { text: 'Text', value: 'text', width: '40%' },
        { text: 'Urgency', value: 'urgency', width: '10%' },
        { text: 'Dates', value: 'dates', width: '20%' },
        { text: 'Active', value: 'isActive', width: '10%' },
        { text: 'Actions', value: 'actions', width: '10%', sortable: false }
      ],
      urgencyLevels: [
        { text: 'Info', value: 'info' },
        { text: 'Success', value: 'success' },
        { text: 'Error', value: 'error' }
      ],
      rules: {
        required: value => (value !== null && value !== undefined && value !== '') || 'This field is required',
        maxLength: value => !value || value.length <= 500 || 'Maximum 500 characters'
      }
    }
  },
  computed: {
    isAuthenticated: get('user/authenticated'),
    permissions: get('user/permissions')
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
    getEmptyBanner() {
      return {
        id: null,
        text: '',
        urgency: 'info',
        startDate: null,
        endDate: null,
        isActive: true
      }
    },
    async loadBanners() {
      this.$store.commit('loadingStart', 'admin-notification-banners-list')
      
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query {
              notificationBanners {
                list {
                  id
                  text
                  urgency
                  startDate
                  endDate
                  isActive
                  createdAt
                  updatedAt
                }
              }
            }
          `,
          fetchPolicy: 'network-only'
        })
        
        this.banners = resp.data.notificationBanners.list || []
        this.updateStoreBanner()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      
      this.$store.commit('loadingStop', 'admin-notification-banners-list')
    },
    createBanner() {
      this.editMode = false
      this.currentBanner = this.getEmptyBanner()
      this.dialog = true
    },
    editBanner(banner) {
      this.editMode = true
      this.currentBanner = { ...banner }
      this.dialog = true
    },
    async toggleActiveBanner(banner) {
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $isActive: Boolean!) {
              notificationBanners {
                update(id: $id, isActive: $isActive) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  banner {
                    id
                    isActive
                  }
                }
              }
            }
          `,
          variables: {
            id: banner.id,
            isActive: banner.isActive
          }
        })
        
        if (resp.data.notificationBanners.update.responseResult.succeeded) {
          // If activating, deactivate others locally
          if (banner.isActive) {
            this.banners.forEach(b => {
              if (b.id !== banner.id) {
                b.isActive = false
              }
            })
          }
          
          this.$store.commit('showNotification', {
            message: banner.isActive ? 'Banner activated' : 'Banner deactivated',
            style: 'success',
            icon: 'check'
          })
          
          this.updateStoreBanner()
        } else {
          throw new Error(resp.data.notificationBanners.update.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async saveBanner() {
      if (!this.$refs.form.validate()) return
      
      this.saving = true
      
      try {
        if (this.editMode) {
          // Update existing banner
          const resp = await this.$apollo.mutate({
            mutation: gql`
              mutation (
                $id: Int!
                $text: String!
                $urgency: NotificationBannerUrgency!
                $startDate: Date
                $endDate: Date
                $isActive: Boolean!
              ) {
                notificationBanners {
                  update(
                    id: $id
                    text: $text
                    urgency: $urgency
                    startDate: $startDate
                    endDate: $endDate
                    isActive: $isActive
                  ) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    banner {
                      id
                      text
                      urgency
                      startDate
                      endDate
                      isActive
                      createdAt
                      updatedAt
                    }
                  }
                }
              }
            `,
            variables: {
              id: this.currentBanner.id,
              text: this.currentBanner.text,
              urgency: this.currentBanner.urgency.toUpperCase(),
              startDate: this.currentBanner.startDate || null,
              endDate: this.currentBanner.endDate || null,
              isActive: this.currentBanner.isActive
            }
          })
          
          if (resp.data.notificationBanners.update.responseResult.succeeded) {
            const index = this.banners.findIndex(b => b.id === this.currentBanner.id)
            if (index !== -1) {
              this.$set(this.banners, index, resp.data.notificationBanners.update.banner)
            }
            
            this.$store.commit('showNotification', {
              message: 'Banner updated successfully',
              style: 'success',
              icon: 'check'
            })
          } else {
            throw new Error(resp.data.notificationBanners.update.responseResult.message)
          }
        } else {
          // Create new banner
          const resp = await this.$apollo.mutate({
            mutation: gql`
              mutation (
                $text: String!
                $urgency: NotificationBannerUrgency!
                $startDate: Date
                $endDate: Date
                $isActive: Boolean!
              ) {
                notificationBanners {
                  create(
                    text: $text
                    urgency: $urgency
                    startDate: $startDate
                    endDate: $endDate
                    isActive: $isActive
                  ) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    banner {
                      id
                      text
                      urgency
                      startDate
                      endDate
                      isActive
                      createdAt
                      updatedAt
                    }
                  }
                }
              }
            `,
            variables: {
              text: this.currentBanner.text,
              urgency: this.currentBanner.urgency.toUpperCase(),
              startDate: this.currentBanner.startDate || null,
              endDate: this.currentBanner.endDate || null,
              isActive: this.currentBanner.isActive
            }
          })
          
          if (resp.data.notificationBanners.create.responseResult.succeeded) {
            this.banners.unshift(resp.data.notificationBanners.create.banner)
            
            this.$store.commit('showNotification', {
              message: 'Banner created successfully',
              style: 'success',
              icon: 'check'
            })
          } else {
            throw new Error(resp.data.notificationBanners.create.responseResult.message)
          }
        }
        
        this.updateStoreBanner()
        this.closeDialog()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      
      this.saving = false
    },
    updateStoreBanner() {
      // Find the first active banner and update the store
      const activeBanner = this.banners.find(b => this.isBannerActive(b))
      
      // Update the store using pathify mutation
      this.$store.commit('site/SET_NOTIFICATION_BANNER', activeBanner || null)
    },
    deleteBannerDialog(banner) {
      this.bannerToDelete = banner
      this.deleteDialog = true
    },
    async confirmDelete() {
      this.deleting = true
      
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              notificationBanners {
                delete(id: $id) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.bannerToDelete.id
          }
        })
        
        if (resp.data.notificationBanners.delete.responseResult.succeeded) {
          const index = this.banners.findIndex(b => b.id === this.bannerToDelete.id)
          if (index !== -1) {
            this.banners.splice(index, 1)
          }
          
          this.$store.commit('showNotification', {
            message: 'Banner deleted successfully',
            style: 'success',
            icon: 'check'
          })
          
          this.updateStoreBanner()
          this.deleteDialog = false
        } else {
          throw new Error(resp.data.notificationBanners.delete.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      
      this.deleting = false
    },
    closeDialog() {
      this.dialog = false
      this.currentBanner = this.getEmptyBanner()
      if (this.$refs.form) {
        this.$refs.form.resetValidation()
      }
    },
    getUrgencyColor(urgency) {
      switch (urgency.toLowerCase()) {
        case 'error':
          return '#f64059'
        case 'success':
          return '#57cf80'
        case 'info':
        default:
          return '#12abdb'
      }
    },
    formatDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString()
    }
  },
  mounted() {
    this.loadBanners()
  }
}
</script>

<style lang='scss'>
@import '@/scss/global.scss';

.v-btn.btn-rounded {
  border-radius: 20px;
  
  span {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-weight: 500;
  }
}

.dialog-header {
  background-color: mc("surface-dark", "primary-blue-lite");
  padding: 16px 24px;
  display: flex;
  align-items: center;
  
  &.is-short {
    padding: 12px 24px;
  }
  
  span {
    font-size: 18px;
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
}
</style>
