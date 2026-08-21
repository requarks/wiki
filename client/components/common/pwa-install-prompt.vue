<template lang='pug'>
  v-app.pwa-install-sheet-app(flat)
    transition(name='pwa-sheet')
      .pwa-install-sheet(v-if='isVisible', role='dialog', aria-live='polite')
        .pwa-install-sheet__panel
          button.pwa-install-sheet__close(type='button', aria-label='No', @click='dismissNo')
            v-icon(color='grey darken-1', small) mdi-close
          .pwa-install-sheet__body
            p.pwa-install-sheet__message
              span আপনি কি&nbsp;
              strong {{ appName }}
              span &nbsp;এপলিকেশনটি ইন্সটল করতে চান?
          .pwa-install-sheet__actions
            v-btn.pwa-install-sheet__yes(block, large, color='primary', depressed, @click='confirmInstall') অবশ্যই
            button.pwa-install-sheet__never(type='button', @click='dismissNever') কখনই না
</template>

<script>
import { get } from 'vuex-pathify'

const PWA_INSTALL_SESSION_DISMISSED_KEY = 'wiki-pwa-install-session-dismissed'
const PWA_INSTALL_NEVER_KEY = 'wiki-pwa-install-never'
const PWA_INSTALL_INSTALLED_KEY = 'wiki-pwa-installed'

export default {
  data () {
    return {
      deferredPrompt: null,
      isVisible: false,
      dismissedThisLoad: false
    }
  },
  computed: {
    printView: get('site/printView'),
    mode: get('page/mode'),
    appName: get('site/pwaAppName')
  },
  watch: {
    printView () {
      this.tryOpenSheet()
    },
    mode () {
      this.tryOpenSheet()
    }
  },
  mounted () {
    window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt)
    window.addEventListener('wiki-pwa-install-ready', this.onDeferredInstallReady)
    window.addEventListener('appinstalled', this.onAppInstalled)
    this.syncDeferredPrompt()
  },
  beforeDestroy () {
    window.removeEventListener('beforeinstallprompt', this.onBeforeInstallPrompt)
    window.removeEventListener('wiki-pwa-install-ready', this.onDeferredInstallReady)
    window.removeEventListener('appinstalled', this.onAppInstalled)
  },
  methods: {
    canOfferInstall () {
      if (this.printView) { return false }
      if (this.mode === 'edit') { return false }
      if (this.isStandalone()) { return false }
      if (this.isAlreadyInstalled()) { return false }
      if (this.isNeverDismissed()) { return false }
      if (this.isSessionDismissed()) { return false }
      if (this.dismissedThisLoad) { return false }
      return true
    },
    isStandalone () {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    },
    isAlreadyInstalled () {
      try {
        return window.localStorage.getItem(PWA_INSTALL_INSTALLED_KEY) === '1'
      } catch (err) {
        return false
      }
    },
    markInstalled () {
      try {
        window.localStorage.setItem(PWA_INSTALL_INSTALLED_KEY, '1')
      } catch (err) {
        // ignore storage failures
      }
    },
    isNeverDismissed () {
      try {
        return window.localStorage.getItem(PWA_INSTALL_NEVER_KEY) === '1'
      } catch (err) {
        return false
      }
    },
    markNeverDismissed () {
      try {
        window.localStorage.setItem(PWA_INSTALL_NEVER_KEY, '1')
      } catch (err) {
        // ignore storage failures
      }
    },
    isSessionDismissed () {
      try {
        return window.sessionStorage.getItem(PWA_INSTALL_SESSION_DISMISSED_KEY) === '1'
      } catch (err) {
        return false
      }
    },
    markSessionDismissed () {
      try {
        window.sessionStorage.setItem(PWA_INSTALL_SESSION_DISMISSED_KEY, '1')
      } catch (err) {
        // ignore storage failures
      }
    },
    openSheet () {
      this.tryOpenSheet()
    },
    tryOpenSheet () {
      if (!this.deferredPrompt || !this.canOfferInstall() || this.isVisible) {
        return
      }
      this.isVisible = true
    },
    syncDeferredPrompt () {
      if (window.__wikiDeferredInstallPrompt) {
        this.deferredPrompt = window.__wikiDeferredInstallPrompt
        this.$nextTick(() => {
          this.tryOpenSheet()
        })
      }
    },
    storeDeferredPrompt (event) {
      window.__wikiDeferredInstallPrompt = event
      this.deferredPrompt = event
      this.tryOpenSheet()
    },
    onBeforeInstallPrompt (event) {
      event.preventDefault()
      this.storeDeferredPrompt(event)
    },
    onDeferredInstallReady () {
      this.syncDeferredPrompt()
    },
    onAppInstalled () {
      this.markInstalled()
      this.closeSheet(false)
    },
    async confirmInstall () {
      if (!this.deferredPrompt) {
        this.closeSheet(true)
        return
      }

      this.deferredPrompt.prompt()
      const choice = await this.deferredPrompt.userChoice
      this.deferredPrompt = null

      if (choice.outcome === 'accepted') {
        this.markInstalled()
      }

      this.closeSheet(true)
    },
    dismissNo () {
      this.markSessionDismissed()
      this.dismissedThisLoad = true
      this.isVisible = false
    },
    dismissNever () {
      this.markNeverDismissed()
      this.isVisible = false
    },
    closeSheet (markLoadDismissed) {
      this.isVisible = false
      if (markLoadDismissed) {
        this.dismissedThisLoad = true
      }
    }
  }
}
</script>

<style lang='scss'>
.pwa-install-sheet-app.v-application {
  position: fixed;
  inset: 0;
  z-index: 999;
  pointer-events: none;
  background: transparent !important;
  min-height: 0 !important;

  .v-application--wrap {
    min-height: 0 !important;
    background: transparent !important;
  }
}

.pwa-install-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  justify-content: center;
  pointer-events: none;

  &__panel {
    pointer-events: auto;
    position: relative;
    width: 100%;
    max-width: 520px;
    background: #fff;
    color: rgba(0, 0, 0, 0.87);
    border-radius: 16px 16px 0 0;
    padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
  }

  &__close {
    position: absolute;
    top: 10px;
    right: 10px;
    border: 0;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 50%;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }

  &__body {
    text-align: center;
    padding: 14px 8px 12px;
  }

  &__message {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.45;
    color: rgba(0, 0, 0, 0.87);

    span,
    strong {
      color: rgba(0, 0, 0, 0.87);
    }

    strong {
      font-weight: 700;
    }
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__yes {
    text-transform: none;
    font-weight: 600;
    letter-spacing: 0;
  }

  &__never {
    border: 0;
    background: transparent;
    color: rgba(0, 0, 0, 0.45);
    font-size: 0.8125rem;
    padding: 6px;
    cursor: pointer;
  }
}

body.has-mobile-bottom-nav .pwa-install-sheet {
  bottom: 56px;
}

.pwa-sheet-enter-active,
.pwa-sheet-leave-active {
  transition: opacity 0.24s ease;

  .pwa-install-sheet__panel {
    transition: transform 0.24s ease;
  }
}

.pwa-sheet-enter,
.pwa-sheet-leave-to {
  opacity: 0;

  .pwa-install-sheet__panel {
    transform: translateY(100%);
  }
}
</style>
