/**
 * App Tour Configuration
 *
 * This file contains all tour steps for the main application tour.
 * Steps are executed in order and can trigger actions across different components.
 *
 * FALLBACK MECHANISM:
 * Steps are filtered before tour starts to only include those with existing DOM elements.
 * This prevents errors when users don't have permissions to see certain features.
 */

import { messages } from '../messages'

/**
 * Check if an element exists in the DOM
 * @param {string} selector - CSS selector to check
 * @returns {boolean} - True if element exists, false otherwise
 */
const elementExists = (selector) => {
  try {
    // Handle multiple selectors (comma-separated)
    const selectors = selector.split(',').map(s => s.trim())
    return selectors.some(s => document.querySelector(s) !== null)
  } catch (e) {
    console.warn(`Invalid selector: ${selector}`, e)
    return false
  }
}

const tourSteps = [
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

  // STEP 5: Focus on page header
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

  // STEP 6: Focus on Follow/Unfollow button - FINISH
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
]

/**
 * Get filtered steps that have existing elements
 * Removes steps where target elements are not in the DOM
 * @returns {Array} - Array of available tour steps
 */
const getAvailableSteps = () => {
  const availableSteps = tourSteps.filter(step => {
    const hasElement = elementExists(step.target)
    if (!hasElement) {
      console.debug(`Tour step skipped - element not found: ${step.target}`)
    }
    return hasElement
  })
  
  console.debug(`Tour: ${availableSteps.length} of ${tourSteps.length} steps available`)
  return availableSteps
}

export default {
  name: 'appTour',
  steps: tourSteps,
  getAvailableSteps,

  // Global callbacks
  callbacks: {
    onStart: () => {
      // Tour started
      console.debug('Tour: Started')
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
    }
  }
}

