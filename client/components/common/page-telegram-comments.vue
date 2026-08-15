<template lang="pug">
  .page-telegram-comments
    v-alert.page-telegram-comments__local-notice(
      v-if='showLocalDevNotice'
      type='info'
      text
      dense
      outlined
    )
      | Telegram comments (comments.app) only work on your registered domain (sunninoor.com), not on localhost. The widget will appear after you deploy.
    .page-telegram-comments__mount(ref='mount')
</template>

<script>
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

export default {
  props: {
    websiteId: {
      type: String,
      required: true
    },
    limit: {
      type: Number,
      default: 5
    },
    pageUrl: {
      type: String,
      default: ''
    },
    pageTitle: {
      type: String,
      default: ''
    }
  },
  computed: {
    showLocalDevNotice () {
      return LOCAL_HOSTNAMES.has(window.location.hostname)
    }
  },
  mounted () {
    this.loadWidget()
  },
  beforeDestroy () {
    this.removeWidget()
  },
  methods: {
    removeWidget () {
      if (this._scriptEl && this._scriptEl.parentNode) {
        this._scriptEl.parentNode.removeChild(this._scriptEl)
      }
      if (this._iframeEl && this._iframeEl.parentNode) {
        this._iframeEl.parentNode.removeChild(this._iframeEl)
      }
    },
    loadWidget () {
      if (!this.websiteId || !this.$refs.mount) { return }

      this.removeWidget()

      const script = document.createElement('script')
      script.src = 'https://comments.app/js/widget.js?3'
      script.async = true
      script.setAttribute('data-comments-app-website', this.websiteId)
      script.setAttribute('data-limit', String(this.limit))
      if (this.pageUrl) {
        script.setAttribute('data-page-url', this.pageUrl)
      }
      if (this.pageTitle) {
        script.setAttribute('data-page-title', this.pageTitle)
      }
      script.addEventListener('load', () => {
        const iframeIdPrefix = `comments-app-${this.websiteId.replace(/[^a-z0-9_]/ig, '-')}-`
        this._iframeEl = document.querySelector(`iframe[id^="${iframeIdPrefix}"]`)
      })
      this.$refs.mount.appendChild(script)
      this._scriptEl = script
    }
  }
}
</script>

<style lang="scss">
.page-telegram-comments {
  margin-top: 24px;

  &__local-notice {
    margin-bottom: 12px;
  }

  &__mount iframe {
    display: block;
    width: 100%;
    min-height: 120px;
  }
}
</style>
