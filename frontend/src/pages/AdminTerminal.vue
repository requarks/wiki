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
      <div class="flex-none flex items-center">
        <div v-if="state.connected" class="mr-4 text-right leading-tight">
          <div class="text-xs text-grey">{{ t('admin.terminal.instance') }}</div>
          <div class="flex items-center justify-end gap-1.5 font-mono text-sm">
            <status-light class="admin-terminal-dot" color="positive" pulse />
            {{ state.instance }}
          </div>
        </div>
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

import { FitAddon } from '@xterm/addon-fit'
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
  connecting: false,
  /** Which instance is on the other end of the socket, from its handshake frame. */
  instance: null
})

let socket = null
let term = null
let fitAddon = null
let resizeObserver = null

// REFS

const termDiv = ref(null)

// METHODS

function clearTerminal() {
  term.clear()
}

function connect() {
  if (socket) {
    return
  }
  state.connecting = true
  term.writeln(`> ${t('admin.terminal.connecting')}`)

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${protocol}//${window.location.host}/_terminal/logs`)

  // -> Whether the stream ever started is what tells a session that was refused or never reached the
  //    server apart from one that ran and ended, and only `close` is guaranteed to fire
  let opened = false
  let handshake = false

  socket.addEventListener('open', () => {
    opened = true
    state.connected = true
    state.connecting = false
    term.writeln(`> ${t('admin.terminal.connected')}`)
  })

  socket.addEventListener('message', (ev) => {
    /*
      The server's first frame is the handshake and says which instance answered; everything after it
      is a log line to be printed verbatim. See `controllers/terminal.ts`.
    */
    if (!handshake) {
      handshake = true
      state.instance = JSON.parse(ev.data).instance
      return
    }
    term.writeln(ev.data)
  })

  socket.addEventListener('close', (ev) => {
    socket = null
    state.connected = false
    state.connecting = false
    state.instance = null
    /*
      Codes in the 4000 range are the server's own (see `controllers/terminal.ts`) and mean the
      session was refused rather than dropped, so the reason is worth printing — reconnecting with the
      same session would be refused just as fast. Anything else that closes without ever having opened
      never reached the server, and a browser will not say why.
    */
    if (ev.code >= 4000) {
      term.writeln(`!> ${t('admin.terminal.connectError')} ${ev.reason}`)
    } else if (opened) {
      term.writeln(`> ${t('admin.terminal.disconnected')}`)
    } else {
      term.writeln(`!> ${t('admin.terminal.connectError')}`)
    }
  })
}

function disconnect() {
  socket?.close()
}

// MOUNTED

onMounted(() => {
  term = new Terminal({
    cursorBlink: false,
    // -> Nothing is sent back to the server: this is a log view, not a shell
    disableStdin: true,
    convertEol: true,
    scrollback: 5000,
    fontSize: 13
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(termDiv.value)
  fitAddon.fit()

  // -> The terminal sizes itself in whole rows and columns, so it has to be told when the box it sits
  //    in changes — the admin drawer collapsing counts, not just the window
  resizeObserver = new ResizeObserver(() => {
    fitAddon.fit()
  })
  resizeObserver.observe(termDiv.value)

  connect()
})

// BEFORE UNMOUNT

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  socket?.close()
  socket = null
  term?.dispose()
})
</script>

<style lang="scss">
.admin-terminal {
  /* -> `status-light` is a bar sized by whatever it sits in; here it wants to be a dot */
  &-dot {
    width: 6px;
    height: 6px;
    min-height: 6px;
    flex: none;
  }

  &-term {
    width: 100%;
    /* -> The terminal fits itself to this box, so the box has to have a height of its own: sized off
          the viewport, it can't grow with its own output and set the resize observer off in a loop */
    height: calc(100vh - 260px);
    min-height: 240px;
    background-color: #000;
    border-radius: 5px;
    overflow: hidden;
    padding: 10px;
  }
}
</style>
