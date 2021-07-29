const ImageOverlay = (src) => `
<div class="ty-image-overlay">
    <a href="${src}" target="_blank" class="v-btn v-btn--contained theme--light v-size--default primary" aria-label="In neuem Tab öffnen">
      <span class="v-btn__content">
          <i aria-hidden="true" class="v-icon v-icon--left notranslate mdi mdi-open-in-new theme--light"></i>
          In neuem Tab öffnen
      </span>
    </a>
</div>
`

module.exports = ImageOverlay
