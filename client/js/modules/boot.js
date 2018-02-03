export default {
  readyStates: [],
  callbacks: [],
  /**
   * Check if event has been sent
   *
   * @param {String} evt Event name
   * @returns {Boolean} True if fired
   */
  isReady (evt) {
    return this.readyStates.indexOf(evt) >= 0
  },
  /**
   * Register a callback to be executed when event is sent
   *
   * @param {String} evt Event name to register to
   * @param {Function} clb Callback function
   * @param {Boolean} once If the callback should be called only once
   */
  register (evt, clb, once) {
    if (this.isReady(evt)) {
      clb()
    } else {
      this.callbacks.push({
        event: evt,
        callback: clb,
        once: false,
        called: false
      })
    }
  },
  /**
   * Register a callback to be executed only once when event is sent
   *
   * @param {String} evt Event name to register to
   * @param {Function} clb Callback function
   */
  registerOnce (evt, clb) {
    this.register(evt, clb, true)
  },
  /**
   * Set ready state and execute callbacks
   */
  notify (evt) {
    this.readyStates.push(evt)
    this.callbacks.forEach(clb => {
      if (clb.event === evt) {
        if (clb.once && clb.called) {
          return
        }
        clb.called = true
        clb.callback()
      }
    })
  },
  /**
   * Execute callback on DOM ready
   *
   * @param {Function} clb Callback function
   */
  onDOMReady (clb) {
    if (document.readyState === 'interactive' || document.readyState === 'complete' || document.readyState === 'loaded') {
      clb()
    } else {
      document.addEventListener('DOMContentLoaded', clb)
    }
  }
}
