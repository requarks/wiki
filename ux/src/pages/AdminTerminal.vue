<template lang='pug'>
q-page.admin-terminal
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-linux-terminal-animated.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.terminal.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.terminal.subtitle') }}
    .col-auto.flex
      q-btn.acrylic-btn.q-mr-sm(
        v-if='!state.connected || state.connecting'
        flat
        icon='las la-link'
        :label='t(`admin.terminal.connect`)'
        color='positive'
        @click='connect'
        :loading='state.connecting'
        :disabled='state.connecting'
      )
      q-btn.acrylic-btn.q-mr-sm(
        v-else
        flat
        icon='las la-unlink'
        :label='t(`admin.terminal.disconnect`)'
        color='negative'
        @click='disconnect'
      )
      q-btn.acrylic-btn.q-mr-md(
        flat
        icon='las la-ban'
        :label='t(`admin.terminal.clear`)'
        color='primary'
        @click='clearTerminal'
      )
      q-separator.q-mr-md(vertical)
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/admin/terminal`'
        target='_blank'
        type='a'
        )
  q-separator(inset)
  .q-pa-md.q-gutter-md
    q-card.shadow-1
      .admin-terminal-term(ref='termDiv')

</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { io } from 'socket.io-client'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'

import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.terminal.title')
})

// DATA

const state = reactive({
  displayMode: 'logs',
  connected: false,
  connecting: false
})

let socket = null
let term = null

// REFS

const termDiv = ref(null)

// METHODS

function clearTerminal () {
  term.clear()
  term.focus()
}

function connect () {
  state.connecting = true
  socket.connect()
}

function disconnect () {
  socket.disconnect()
}

// MOUNTED

onMounted(() => {
  term = new Terminal({
    cursorBlink: true,
    cols: 128
  })
  term.open(termDiv.value)
  term.writeln(`> ${t('admin.terminal.connecting')}`)
  state.connecting = true

  // socket = io(window.location.host, {
  socket = io('localhost:3000', {
    path: '/_ws/',
    auth: {
      token: 'TEST' // TODO: Use active token
    },
    autoConnect: false
  })
  socket.on('connect', () => {
    term.writeln(`> ${t('admin.terminal.connected')}`)
    state.connected = true
    state.connecting = false
    socket.emit('server:logs')
  })
  socket.on('disconnect', () => {
    term.writeln(`> ${t('admin.terminal.disconnected')}`)
    state.connected = false
  })
  socket.on('connect_error', (err) => {
    console.warn(err)
    term.writeln(`!> ${t('admin.terminal.connectError')} ${err.message}`)
  })
  socket.on('server:log', (msg) => {
    term.writeln(msg)
    term.focus()
  })
  socket.connect()
})

// BEFORE UNMOUNT

onBeforeUnmount(() => {
  if (socket?.connected) {
    socket.disconnect()
  }
})
</script>

<style lang='scss'>
.admin-terminal {
  &-term {
    width: 100%;
    background-color: #000;
    border-radius: 5px;
    overflow: hidden;
    padding: 10px;
  }
}
</style>
