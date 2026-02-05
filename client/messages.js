export const PAGE_DELETE_HAS_SUBPAGES_MSG = 'Delete not possible! Selected page has sub pages'

export const messages = {
  printPage: 'Print Page',
  exportToWord: 'Export to Word',
  exportToPdf: 'Export to PDF',
  exportModalSubtitle: 'This page has sub-pages, do you want to include them in the export?',
  exportSinglePage: 'Export only this page',
  exportPageTree: 'Export this page and all sub-pages',
  exporting: 'Exporting...',
  cancel: 'Cancel',

  // App tour texts
  appTour: {
    siteSelector: {
      title: 'Site Selector',
      content: 'Use this dropdown to switch between different sites you have access to. Each site can have its own content and settings.'
    },
    followSite: {
      title: 'Follow Site',
      content: 'Click here to follow this site. You\'ll receive notifications about updates and changes to pages in this site.'
    },
    pageActions: {
      title: 'Page Actions',
      content: 'Click this button to access various page actions like viewing, editing, managing history, and more.'
    },
    newPage: {
      title: 'Create New Page',
      content: 'Click this button to create a new page in the current site. A dialog will open where you can configure your new page.'
    },
    
    pageHeader: {
      title: 'Page Header',
      content: 'This is the main content area where all page content is displayed. Here you can read articles, documentation, and other information published on the wiki.'
    },
    followPage: {
      title: 'Follow Page',
      content: 'Use this button to follow or unfollow a page. When you follow a page, you\'ll receive notifications about updates and changes. This completes the tour! You can restart it anytime from the Resources menu.'
    }
  }
}
