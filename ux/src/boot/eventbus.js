import { boot } from 'quasar/wrappers'
import mitt from 'mitt'

export default boot(({ app }) => {
  const emitter = mitt()

  if (import.meta.env.SSR) {
    global.EVENT_BUS = emitter
  } else {
    window.EVENT_BUS = emitter
  }
})
