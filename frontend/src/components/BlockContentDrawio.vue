<template>
  <div class="block-content-drawio">
    <iframe
      ref="frameEl"
      class="block-content-drawio-frame"
      :src="editorUrl"
      :title="t('editor.blockContent.drawioTitle')" />
    <!--
      Covers the frame until draw.io says hello, and stays covering it if it never does. The editor is
      loaded from another host, so "nothing appeared" is a real outcome — an offline wiki, a blocked
      origin, a self-hosted deployment that has moved — and a blank white rectangle explains none of
      that.
    -->
    <div v-if="!state.ready" class="block-content-drawio-veil">
      <template v-if="state.timedOut">
        <w-icon name="la:plug" size="42px" />
        <div class="mt-3 text-body1">{{ t('editor.blockContent.drawioUnreachable') }}</div>
        <div class="text-caption mt-1 opacity-70">{{ origin }}</div>
      </template>
      <template v-else>
        <w-spinner size="42px" color="primary" />
        <div class="mt-3 text-caption">{{ t('editor.blockContent.drawioLoading') }}</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'

/**
 * The draw.io drawing surface, as a body editor for `block-drawio`.
 *
 * Everything in this file is draw.io's own: nothing else in the app knows this protocol, and the
 * block system it plugs into knows only that it takes a string of text and gives one back. See
 * `BlockContentEditorOverlay` for what an editor component has to be.
 *
 * draw.io is embedded rather than reimplemented, and it is embedded rather than bundled because it is
 * a whole application. The wiki holds an iframe and talks to it over `postMessage`, which is what the
 * `embed=1&proto=json` mode of any draw.io deployment offers:
 *
 *   in   `{ event: 'init' }`            it is ready to be given a drawing
 *   out  `{ action: 'load', xml, … }`   here is the drawing
 *   in   `{ event: 'autosave', xml }`   the drawing changed
 *   in   `{ event: 'save', xml }`       the author pressed its Save button
 *
 * `autosave` is what keeps this component's model current, so the overlay's own Apply always has the
 * drawing as it stands; `save` is the same thing plus "and close", which is what the author means by
 * pressing it. Nothing is ever uploaded: an embedded draw.io does its work in the browser, and the XML
 * arrives here rather than at whoever is hosting the editor.
 */

// PROPS

const props = defineProps({
  /** The block's body: a draw.io XML document, or empty for a drawing that does not exist yet. */
  modelValue: {
    type: String,
    default: ''
  },
  /** The block's own parameters. Only `server` means anything here. */
  params: {
    type: Object,
    default: () => ({})
  }
})

// EMITS

const emit = defineEmits(['update:modelValue', 'save'])

/**
 * The draw.io that answers when the block names none.
 *
 * `embed.diagrams.net` is the deployment draw.io publishes for exactly this, and it is a different
 * host from the `viewer.diagrams.net` the block reads a finished drawing from — which is why the
 * block's `server` prop has a default on neither side and means "the public services" when empty.
 */
const PUBLIC_EDITOR = 'https://embed.diagrams.net'

/** How long draw.io has to say `init` before the veil stops being a spinner and starts explaining. */
const READY_TIMEOUT = 20000

// DARK MODE

// -> The reader's effective theme, not the site's default: a user who has chosen light on a dark wiki
//    should be drawing on a light canvas
const dark = useDark()

// I18N

const { t } = useI18n()

// DATA

const frameEl = ref(null)

const state = reactive({
  ready: false,
  timedOut: false
})

let readyTimer = null

// COMPUTED

const server = computed(() => String(props.params.server || '').trim() || PUBLIC_EDITOR)

/** Where messages are sent, and the only place they are accepted from. */
const origin = computed(() => {
  try {
    return new URL(server.value).origin
  } catch {
    return ''
  }
})

const editorUrl = computed(() => {
  /*
    `ui` is settled once, when the frame is built, and deliberately does not follow the reader
    switching theme underneath it: the parameter is read at load, so keeping the two in step would
    mean reloading draw.io — and reloading it mid-drawing is the one thing that would lose work.
  */
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '1',
    libraries: '1',
    // -> The overlay's own Cancel is the way out, and two of them beside each other say different
    //    things about the unsaved drawing
    noExitBtn: '1',
    saveAndExit: '0',
    ui: dark.isActive ? 'dark' : 'kennedy'
  })
  return `${server.value.replace(/\/+$/, '')}/?${params.toString()}`
})

// METHODS

function post(message) {
  frameEl.value?.contentWindow?.postMessage(JSON.stringify(message), origin.value || '*')
}

/**
 * One message from the frame.
 *
 * Both the window it came from and the origin it came from are checked. The window because any page
 * may post to any other, and this listener is on `window`; the origin because the frame's own
 * `contentWindow` is still whatever has been navigated into it.
 */
function onMessage(event) {
  if (event.source !== frameEl.value?.contentWindow) {
    return
  }
  if (origin.value && event.origin !== origin.value) {
    return
  }
  let message = null
  try {
    message = JSON.parse(event.data)
  } catch {
    // -> Not ours: draw.io speaks JSON here, and its other protocols do not
    return
  }
  switch (message.event) {
    case 'init':
      state.ready = true
      clearTimeout(readyTimer)
      // -> `autosave` is what makes the frame report every change, which is what Apply relies on
      post({ action: 'load', autosave: 1, xml: props.modelValue })
      break
    case 'autosave':
      emit('update:modelValue', message.xml ?? '')
      break
    case 'save':
      emit('update:modelValue', message.xml ?? '')
      emit('save')
      break
  }
}

// LIFECYCLE

onMounted(() => {
  window.addEventListener('message', onMessage)
  readyTimer = setTimeout(() => {
    state.timedOut = true
  }, READY_TIMEOUT)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  clearTimeout(readyTimer)
})
</script>

<style lang="scss">
.block-content-drawio {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1 1 auto;

  &-frame {
    flex: 1 1 auto;
    border: 0;
    width: 100%;
    height: 100%;
  }

  /* -> Over the frame rather than instead of it: draw.io is loading behind this the whole time */
  &-veil {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 1rem;

    @at-root .body--light & {
      background-color: #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
    }
  }
}
</style>
