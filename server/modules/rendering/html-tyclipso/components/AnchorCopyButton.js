/**
 * @return {string}
 */
function AnchorCopyButton() {
  return `
      <button type="button" class="ty-anchor-button v-btn v-btn--flat v-btn--icon v-btn--round v-size--small" aria-label="Link kopieren">
        <span class="v-btn__content">
          <i aria-hidden="true" class="v-icon notranslate mdi mdi-link-variant" style="font-size: 16px"></i>
          <i aria-hidden="true" class="v-icon notranslate mdi mdi-check-circle" style="font-size: 16px; display: none;"></i>
        </span>
      </button>
    `
}

module.exports = AnchorCopyButton
