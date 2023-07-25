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
    q-item(clickable, tag='a', :href='`mailto:?subject=` + encodeURIComponent(props.title) + `&body=` + encodeURIComponent(urlFormatted) + `%0D%0A%0D%0A` + encodeURIComponent(props.description)', target='_blank')
      q-item-section.items-center(avatar)
        q-icon(color='grey', name='las la-envelope', size='sm')
      q-item-section.q-pr-md Email
</template>

<script setup>
import ClipboardJS from 'clipboard'
import { useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// PROPS

const props = defineProps({
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
})

// QUASAR

const $q = useQuasar()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  width: 626,
  height: 436,
  left: 0,
  top: 0,
  clip: null
})
let clip = null

const copyUrlButton = ref(null)

// COMPUTED

const urlFormatted = computed(() => {
  if (!import.meta.env.SSR) {
    return props.url ? props.url : window.location.href
  } else {
    return ''
  }
})
// METHODS

function openSocialPop (url) {
  const popupWindow = window.open(
    url,
    'sharer',
    `status=no,height=${state.height},width=${state.width},resizable=yes,left=${state.left},top=${state.top},screenX=${state.left},screenY=${state.top},toolbar=no,menubar=no,scrollbars=no,location=no,directories=no`
  )

  popupWindow.focus()
}

function menuShown (ev) {
  clip = new ClipboardJS(copyUrlButton.value.$el, {
    text: () => { return urlFormatted.value }
  })

  clip.on('success', () => {
    $q.notify({
      message: 'URL copied successfully',
      icon: 'las la-clipboard'
    })
  })
  clip.on('error', () => {
    $q.notify({
      type: 'negative',
      message: 'Failed to copy to clipboard'
    })
  })
}

function menuHidden (ev) {
  clip.destroy()
}

// MOUNTED

onMounted(() => {
  /**
   * Center the popup on dual screens
   * http://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen/32261263
   */
  const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : screen.left
  const dualScreenTop = window.screenTop !== undefined ? window.screenTop : screen.top

  const width = window.innerWidth ? window.innerWidth : (document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width)
  const height = window.innerHeight ? window.innerHeight : (document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height)

  state.left = ((width / 2) - (state.width / 2)) + dualScreenLeft
  state.top = ((height / 2) - (state.height / 2)) + dualScreenTop
})
</script>
