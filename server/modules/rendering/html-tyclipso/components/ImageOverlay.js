/**
 * @param {string} src - Image source.
 * @return {string}
 */
function ImageOverlay(src) {
  return `
    <div class="ty-image-overlay">
      <a href="${src}" target="_blank"
         class="v-btn v-btn--icon v-btn--round v-size--default elevation-2 white grey--text text--darken-3"
         aria-label="In neuem Tab öffnen">
        <span class="v-btn__content">
            <i aria-hidden="true" class="v-icon notranslate mdi mdi-open-in-new"></i>
        </span>
      </a>
    </div>
  `
}

module.exports = ImageOverlay
