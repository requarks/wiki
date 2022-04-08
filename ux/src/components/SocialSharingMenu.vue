<template lang="pug">
q-menu(
  auto-close
  anchor='bottom middle'
  self='top middle'
  @show='menuShown'
  @before-hide='menuHidden'
  )
  q-list(dense, padding)
    q-item(clickable, @click='', ref='copyUrlButton')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='las la-clipboard', size='sm')
      q-item-section.q-pr-md Copy URL
    q-item(clickable, tag='a', :href='`mailto:?subject=` + encodeURIComponent(title) + `&body=` + encodeURIComponent(urlFormatted) + `%0D%0A%0D%0A` + encodeURIComponent(description)', target='_blank')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='las la-envelope', size='sm')
      q-item-section.q-pr-md Email
    q-item(clickable, @click='openSocialPop(`https://www.facebook.com/sharer/sharer.php?u=` + encodeURIComponent(urlFormatted) + `&title=` + encodeURIComponent(title) + `&description=` + encodeURIComponent(description))')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='lab la-facebook', size='sm')
      q-item-section.q-pr-md Facebook
    q-item(clickable, @click='openSocialPop(`https://www.linkedin.com/shareArticle?mini=true&url=` + encodeURIComponent(urlFormatted) + `&title=` + encodeURIComponent(title) + `&summary=` + encodeURIComponent(description))')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='lab la-linkedin', size='sm')
      q-item-section.q-pr-md LinkedIn
    q-item(clickable, @click='openSocialPop(`https://www.reddit.com/submit?url=` + encodeURIComponent(urlFormatted) + `&title=` + encodeURIComponent(title))')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='lab la-reddit', size='sm')
      q-item-section.q-pr-md Reddit
    q-item(clickable, @click='openSocialPop(`https://t.me/share/url?url=` + encodeURIComponent(urlFormatted) + `&text=` + encodeURIComponent(title))')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='lab la-telegram', size='sm')
      q-item-section.q-pr-md Telegram
    q-item(clickable, @click='openSocialPop(`https://twitter.com/intent/tweet?url=` + encodeURIComponent(urlFormatted) + `&text=` + encodeURIComponent(title))')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='lab la-twitter', size='sm')
      q-item-section.q-pr-md Twitter
    q-item(clickable, :href='`viber://forward?text=` + encodeURIComponent(urlFormatted) + ` ` + encodeURIComponent(description)')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='lab la-viber', size='sm')
      q-item-section.q-pr-md Viber
    q-item(clickable, @click='openSocialPop(`http://service.weibo.com/share/share.php?url=` + encodeURIComponent(urlFormatted) + `&title=` + encodeURIComponent(title))')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='lab la-weibo', size='sm')
      q-item-section.q-pr-md Weibo
    q-item(clickable, @click='openSocialPop(`https://api.whatsapp.com/send?text=` + encodeURIComponent(title) + `%0D%0A` + encodeURIComponent(urlFormatted))')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='lab la-whatsapp', size='sm')
      q-item-section.q-pr-md Whatsapp
</template>

<script>
import ClipboardJS from 'clipboard'

export default {
  props: {
    url: {
      type: String,
      default: null
    },
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      width: 626,
      height: 436,
      left: 0,
      top: 0,
      clip: null
    }
  },
  computed: {
    urlFormatted () {
      if (!import.meta.env.SSR) {
        return this.url ? this.url : window.location.href
      } else {
        return ''
      }
    }
  },
  methods: {
    openSocialPop (url) {
      const popupWindow = window.open(
        url,
        'sharer',
        `status=no,height=${this.height},width=${this.width},resizable=yes,left=${this.left},top=${this.top},screenX=${this.left},screenY=${this.top},toolbar=no,menubar=no,scrollbars=no,location=no,directories=no`
      )

      popupWindow.focus()
    },
    menuShown (ev) {
      this.clip = new ClipboardJS(this.$refs.copyUrlButton.$el, {
        text: () => { return this.urlFormatted }
      })

      this.clip.on('success', () => {
        this.$q.notify({
          message: 'URL copied successfully',
          icon: 'las la-clipboard'
        })
      })
      this.clip.on('error', () => {
        this.$q.notify({
          type: 'negative',
          message: 'Failed to copy to clipboard'
        })
      })
    },
    menuHidden (ev) {
      this.clip.destroy()
    }
  },
  mounted () {
    /**
     * Center the popup on dual screens
     * http://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen/32261263
     */
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : screen.left
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : screen.top

    const width = window.innerWidth ? window.innerWidth : (document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width)
    const height = window.innerHeight ? window.innerHeight : (document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height)

    this.left = ((width / 2) - (this.width / 2)) + dualScreenLeft
    this.top = ((height / 2) - (this.height / 2)) + dualScreenTop
  }
}
</script>
