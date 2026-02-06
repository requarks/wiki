/**
 * App Tour Configuration
 *
 * This file contains all tour steps for the main application tour.
 * Steps are executed in order and can trigger actions across different components.
 */

import { messages } from '../messages'

export default {
  name: 'appTour',
  steps: [
    // STEP 1: Sites element
    {
      target: '[data-tour="site-selector"]',
      header: {
        title: messages.appTour.siteSelector.title
      },
      content: messages.appTour.siteSelector.content,
      params: {
        placement: 'bottom',
        enableScrolling: false,
        highlight: true
      }
    },

    // STEP 2: Follow/Unfollow sites button
    {
      target: '[data-tour="follow-site"], [data-tour="unfollow-site"]',
      header: {
        title: messages.appTour.followSite.title
      },
      content: messages.appTour.followSite.content,
      params: {
        placement: 'bottom',
        enableScrolling: false,
        highlight: true
      }
    },

    // STEP 3: Page actions
    {
      target: '[data-tour="page-actions"]',
      header: {
        title: messages.appTour.pageActions.title
      },
      content: messages.appTour.pageActions.content,
      params: {
        placement: 'bottom',
        enableScrolling: false,
        highlight: true
      }
    },

    // STEP 4: New Page button
    {
      target: '[data-tour="new-page"]',
      header: {
        title: messages.appTour.newPage.title
      },
      content: messages.appTour.newPage.content,
      params: {
        placement: 'bottom',
        enableScrolling: false,
        highlight: true
      }
    },

    // STEP 6: Focus on page header
    {
      target: '.page-header-headings',
      header: {
        title: messages.appTour.pageHeader.title
      },
      content: messages.appTour.pageHeader.content,
      params: {
        placement: 'top',
        enableScrolling: false,
        highlight: true
      }
    },

    // STEP 7: Focus on Follow/Unfollow button - FINISH
    {
      target: '[data-tour="unfollow-page"], [data-tour="follow-page"]',
      header: {
        title: messages.appTour.followPage.title
      },
      content: messages.appTour.followPage.content,
      params: {
        placement: 'bottom',
        enableScrolling: false,
        highlight: true
      }
    }
  ],

  // Global callbacks
  callbacks: {
    onStart: () => {
      // Tour started
    },
    onStop: () => {
      // Cleanup: close any open modals
      if (window.WIKI) {
        window.WIKI.$root.$emit('tour-cleanup')
      }
    },
    onSkip: () => {
      if (window.WIKI) {
        window.WIKI.$root.$emit('tour-cleanup')
      }
    },
    onFinish: () => {
      if (window.WIKI) {
        window.WIKI.$root.$emit('tour-cleanup')
      }
    },
    onPreviousStep: (currentStep) => {
      // Going to previous step
    },
    onNextStep: (currentStep) => {
      // Going to next step
    },
    onError: (error) => {
      console.error('Tour error:', error)
      // Stop the tour on error to prevent infinite loops
      if (window.WIKI && window.WIKI.$tours && window.WIKI.$tours['appTour']) {
        window.WIKI.$tours['appTour'].stop()
      }
      // Cleanup
      if (window.WIKI) {
        window.WIKI.$root.$emit('tour-cleanup')
      }
    }
  }
}

