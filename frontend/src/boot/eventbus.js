import mitt from 'mitt'

export function initializeEventBus () {
  const emitter = mitt()

  if (import.meta.env.SSR) {
    global.EVENT_BUS = emitter
  } else {
    window.EVENT_BUS = emitter
  }
}
