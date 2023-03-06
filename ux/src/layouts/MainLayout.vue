<template lang='pug'>
q-layout(view='hHh Lpr lff')
  header-nav
  q-drawer.bg-sidebar(
    :modelValue='isSidebarShown'
    show-if-above
    :width='255'
    )
    .sidebar-actions.flex.items-stretch
      q-btn.q-px-sm.col(
        flat
        dense
        icon='las la-globe'
        color='blue-7'
        text-color='blue-2'
        label='EN'
        aria-label='EN'
        size='sm'
        )
      q-separator(vertical)
      q-btn.q-px-sm.col(
        flat
        dense
        icon='las la-sitemap'
        color='blue-7'
        text-color='blue-2'
        label='Browse'
        aria-label='Browse'
        size='sm'
        @click='openFileManager'
        )
    q-scroll-area.sidebar-nav(
      :thumb-style='thumbStyle'
      :bar-style='barStyle'
      )
      q-list(
        clickable
        dense
        dark
        )
        q-item-label.text-blue-2.text-caption(header) Getting Started
        q-item(to='/install')
          q-item-section(side)
            q-icon(name='las la-dog', color='white')
          q-item-section Requirements
        q-item(to='/install')
          q-item-section(side)
            q-icon(name='las la-cat', color='white')
          q-item-section Installation
        q-separator.q-my-sm(dark)
        q-item(to='/install')
          q-item-section(side)
            q-icon(name='las la-cat', color='white')
          q-item-section Installation
    q-bar.bg-blue-9.text-white(dense)
      q-btn.col(
        icon='las la-dharmachakra'
        label='History'
        flat
      )
      q-separator(vertical)
      q-btn.col(
        icon='las la-bookmark'
        label='Bookmarks'
        flat
      )
  q-page-container
    router-view
    q-page-scroller(
      position='bottom-right'
      :scroll-offset='150'
      :offset='[15, 15]'
      )
      q-btn(
        icon='las la-arrow-up'
        color='primary'
        round
        size='md'
      )
  main-overlay-dialog
  footer-nav(v-if='!editorStore.isActive')
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useEditorStore } from 'src/stores/editor'
import { useSiteStore } from 'src/stores/site'

// COMPONENTS

import FooterNav from 'src/components/FooterNav.vue'
import HeaderNav from 'src/components/HeaderNav.vue'
import MainOverlayDialog from 'src/components/MainOverlayDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const editorStore = useEditorStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  titleTemplate: title => `${title} - ${siteStore.title}`
})

// DATA

const leftDrawerOpen = ref(true)
const search = ref('')

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

// COMPUTED

const isSidebarShown = computed(() => {
  return siteStore.showSideNav && !(editorStore.isActive && editorStore.hideSideNav)
})

// METHODS

function openFileManager () {
  siteStore.overlay = 'FileManager'
}

</script>

<style lang="scss">
.sidebar-actions {
  background: linear-gradient(to bottom, rgba(255,255,255,.1) 0%, rgba(0,0,0, .05) 100%);
  border-bottom: 1px solid rgba(0,0,0,.2);
  height: 38px;
}
.sidebar-nav {
  border-top: 1px solid rgba(255,255,255,.15);
  height: calc(100% - 38px - 24px);
}

body.body--dark {
  background-color: $dark-6;
}

.main-overlay {
  > .q-dialog__backdrop {
    background-color: rgba(0,0,0,.6);
    backdrop-filter: blur(5px);
  }
  > .q-dialog__inner {
    padding: 24px 64px;

    @media (max-width: $breakpoint-sm-max) {
      padding: 0;
    }

    > .q-layout-container {
      @at-root .body--light & {
        background-image: linear-gradient(to bottom, $dark-5 10px, $grey-3 11px, $grey-4);
      }
      @at-root .body--dark & {
        background-image: linear-gradient(to bottom, $dark-4 10px, $dark-4 11px, $dark-3);
      }
      border-radius: 6px;
      box-shadow: 0 0 0 1px rgba(0,0,0,.5);
    }
  }
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

.syncing-enter-active {
  animation: syncing-anim .1s;
}
.syncing-leave-active {
  animation: syncing-anim 1s reverse;
}
@keyframes syncing-anim {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>
