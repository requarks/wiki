<template>
  <w-page class="admin-terminal">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-linux-terminal-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.terminal.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.terminal.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <w-btn
          class="acrylic-btn mr-2"
          v-if="!state.connected || state.connecting"
          flat
          icon="la:link"
          :label="t(`admin.terminal.connect`)"
          color="positive"
          @click="connect"
          :loading="state.connecting"
          :disabled="state.connecting" />
        <w-btn
          class="acrylic-btn mr-2"
          v-else
          flat
          icon="la:unlink"
          :label="t(`admin.terminal.disconnect`)"
          color="negative"
          @click="disconnect" />
        <w-btn
          class="acrylic-btn mr-4"
          flat
          icon="la:ban"
          :label="t(`admin.terminal.clear`)"
          color="primary"
          @click="clearTerminal" />
        <w-separator class="mr-4" vertical />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/terminal`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
      </div>
    </div>
    <w-separator inset />
    <div class="p-4 gap-4">
      <w-card><div class="admin-terminal-term" ref="termDiv" /></w-card>
    </div>
  </w-page>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'

import { useSiteStore } from '@/stores/site'

import { io } from 'socket.io-client'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'

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

function clearTerminal() {
  term.clear()
  term.focus()
}

function connect() {
  state.connecting = true
  socket.connect()
}

function disconnect() {
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
  socket = io(window.location.host, {
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

<style lang="scss">
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
