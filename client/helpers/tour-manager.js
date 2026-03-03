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
       * Steps are pre-filtered by the nav-header computed property
       */
      startAppTour () {
        if (window.WIKI && window.WIKI.$tours && window.WIKI.$tours['appTour']) {
          
            if (window.WIKI && window.WIKI.$tours && window.WIKI.$tours['appTour']) {
              const tour = window.WIKI.$tours['appTour']
              
              // Check if there are any steps available
              if (!tour.steps || tour.steps.length === 0) {
                console.warn('App tour: No available steps for current user permissions')
                return
              }
              
            
              tour.start()
            }
        
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
