<template lang='pug'>
q-layout(view='hHh Lpr lff')
  header-nav
  q-page-container.layout-profile
    .layout-profile-card
      .layout-profile-sd
        q-list
          q-item(
            v-for='navItem of sidenav'
            :key='navItem.key'
            clickable
            :to='`/_profile/` + navItem.key'
            active-class='is-active'
            v-ripple
            )
            q-item-section(side)
              q-icon(:name='navItem.icon')
            q-item-section
              q-item-label {{navItem.label}}
          q-separator.q-my-sm(inset)
          q-item(
            clickable
            v-ripple
            to='/_profile/me'
            )
            q-item-section(side)
              q-icon(name='las la-id-card')
            q-item-section
              q-item-label View Public Profile
          q-separator.q-my-sm(inset)
          q-item(
            clickable
            v-ripple
            href='/logout'
            )
            q-item-section(side)
              q-icon(name='las la-sign-out-alt', color='negative')
            q-item-section
              q-item-label.text-negative Logout
      router-view
  q-footer
    q-bar.justify-center(dense)
      span(style='font-size: 11px;') &copy; Cyberdyne Systems Corp. 2020 | Powered by #[strong Wiki.js]
</template>

<script setup>
import gql from 'graphql-tag'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive, watch } from 'vue'

import { useSiteStore } from 'src/stores/site'

import HeaderNav from '../components/HeaderNav.vue'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const sidenav = [
  {
    key: 'info',
    label: 'Profile',
    icon: 'las la-user-circle'
  },
  {
    key: 'avatar',
    label: 'Avatar',
    icon: 'las la-otter'
  },
  {
    key: 'password',
    label: 'Authentication',
    icon: 'las la-key'
  },
  {
    key: 'groups',
    label: 'Groups',
    icon: 'las la-users'
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: 'las la-bell'
  },
  {
    key: 'pages',
    label: 'My Pages',
    icon: 'las la-file-alt'
  },
  {
    key: 'activity',
    label: 'Activity',
    icon: 'las la-history'
  }
]
const thumbStyle = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: '#FFF',
  width: '5px',
  opacity: 0.5
}
const barStyle = {
  backgroundColor: '#000',
  width: '9px',
  opacity: 0.1
}
</script>

<style lang="scss">
.layout-profile {
  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  &:before {
    content: '';
    height: 350px;
    position: fixed;
    top: 0;
    width: 100%;
    background: radial-gradient(ellipse at bottom, $dark-3, $dark-6);
    border-bottom: 1px solid #FFF;

    @at-root .body--dark & {
      border-bottom-color: $dark-3;
    }
  }

  &:after {
    content: '';
    height: 1px;
    position: fixed;
    top: 64px;
    width: 100%;
    background: linear-gradient(to right, transparent 0%, rgba(255,255,255,.1) 50%, transparent 100%);
  }

  &-card {
    position: relative;
    width: 90%;
    max-width: 1400px;
    margin: 50px auto;
    box-shadow: $shadow-2;
    border-radius: 7px;
    display: flex;
    align-items: stretch;
    height: 100%;

    @at-root .body--light & {
      background-color: #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-3;
    }
  }

  &-sd {
    flex: 0 0 300px;
    border-radius: 8px 0 0 8px;
    overflow: hidden;

    @at-root .body--light & {
      background-color: $grey-1;
      border-right: 1px solid rgba($dark-3, .1);
      box-shadow: inset -1px 0 0 #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-right: 1px solid rgba(#FFF, .12);
      box-shadow: inset -1px 0 0 rgba($dark-6, .5);
    }

    .q-list .q-item {
      font-weight: 500;
      color: $grey-9;

      @at-root .body--dark & {
        color: rgba(255,255,255,.75);
      }

      &.is-active {
        background: linear-gradient(to bottom, rgba($primary, .25), rgba($primary, .1));
        color: $primary;

        .q-icon {
          color: $primary;
        }
      }
    }
  }

  .q-page {
    flex: 1 1;

    @at-root .body--light & {
      border-left: 1px solid #FFF;
    }
    @at-root .body--dark & {
      border-left: 1px solid rgba($dark-6, .75);
    }
  }

  .text-header {
    font-weight: 500;
    font-size: 17px;
    padding: 0 16px 6px 16px;
    color: $primary;
    position: relative;
    background: linear-gradient(to left, #FFF, transparent), linear-gradient(to top, rgba($primary, .075), transparent);
    margin-bottom: 10px;

    @at-root .body--dark & {
      background: linear-gradient(to left, $dark-3, transparent), linear-gradient(to top, rgba($primary, .075), transparent);
    }

    &:before {
      content: '';
      width: 100%;
      height: 10px;
      background: linear-gradient(to left, #FFF, transparent), linear-gradient(to bottom, rgba($primary, .05), transparent);
      position: absolute;
      bottom: -13px;
      left: 0;
      z-index: 0;

      @at-root .body--dark & {
        background: linear-gradient(to left,$dark-3, transparent), linear-gradient(to bottom, rgba($primary, .05), transparent);
      }
    }

    &:after {
      content: '';
      width: 100%;
      height: 1px;
      background: linear-gradient(to left, transparent, rgba($primary, .25));
      position: absolute;
      bottom: -2px;
      left: 0;
      z-index: 0;
    }
  }

  .actions-bar {
    display: flex;
    padding: 16px;
    background: linear-gradient(to right, #FFF, transparent), linear-gradient(to bottom, rgba($secondary, .1), transparent);
    justify-content: flex-end;
    position: relative;

    @at-root .body--dark & {
      background: linear-gradient(to right, $dark-3, transparent), linear-gradient(to bottom, rgba($secondary, .1), transparent);
    }

    &:before {
      content: '';
      width: 100%;
      height: 10px;
      background: linear-gradient(to right, #FFF, transparent), linear-gradient(to top, rgba($secondary, .05), transparent);
      position: absolute;
      top: -13px;
      left: 0;
      z-index: 0;

      @at-root .body--dark & {
        background: linear-gradient(to right, $dark-3, transparent), linear-gradient(to top, rgba($secondary, .05), transparent);
      }
    }

    &:after {
      content: '';
      width: 100%;
      height: 1px;
      background: linear-gradient(to right, transparent, rgba($secondary, .25));
      position: absolute;
      top: -2px;
      left: 0;
      z-index: 0;
    }
  }
}

body.body--dark {
  background-color: $dark-6;
}

.q-footer {
  .q-bar {
    @at-root .body--light & {
      background-color: $grey-3;
      color: $grey-7;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      color: rgba(255,255,255,.3);
    }
  }
}
</style>
