/* global $ */

if ($('#page-type-view').length) {
  let currentBasePath = ($('#page-type-view').data('entrypath') !== 'home') ? $('#page-type-view').data('entrypath') : '' // eslint-disable-line no-unused-vars

  /* eslint-disable spaced-comment */
  //=include ../modals/create.js
  //=include ../modals/move.js
  /* eslint-enable spaced-comment */
}
