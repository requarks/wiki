/**
 * Tour Manager Plugin
 *
 * Provides global tour management functionality across the application.
 * Integrates with vue-tour to provide centralized tour control.
 */

import appTour from '../tours/app-tour'

export default {
  install (Vue) {
    // Add global tour manager to Vue prototype
    Vue.prototype.$tourManager = {
      /**
       * Start the main application tour
       */
      startAppTour () {
        if (window.WIKI && window.WIKI.$tours && window.WIKI.$tours['appTour']) {
          window.WIKI.$tours['appTour'].start()
        } else {
          console.warn('App tour not available')
        }
      },

      /**
       * Stop all active tours
       */
      stopAllTours () {
        if (window.WIKI && window.WIKI.$tours) {
          Object.keys(window.WIKI.$tours).forEach(tourName => {
            if (window.WIKI.$tours[tourName]) {
              window.WIKI.$tours[tourName].stop()
            }
          })
        }
        if (window.WIKI && window.WIKI.$root) {
          window.WIKI.$root.$emit('tour-cleanup')
        }
      },

      /**
       * Check if a tour is currently active
       */
      isTourActive () {
        if (window.WIKI && window.WIKI.$tours) {
          return Object.keys(window.WIKI.$tours).some(tourName => {
            const tour = window.WIKI.$tours[tourName]
            return tour && tour.currentStep >= 0
          })
        }
        return false
      }
    }
  }
}

export { appTour }
