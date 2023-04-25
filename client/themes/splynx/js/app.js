/* THEME SPECIFIC JAVASCRIPT */

// Global "Open in modal" images events handler
document.addEventListener('readystatechange', (state) => {
  const images = state.target.querySelectorAll('.v-main img');
  if (images.length) {
    Array.from(images).forEach((image) => {
      if (image.width > 18 || image.height > 18) {
        image.classList.add('modal-open');
      }
    });
  }
});
document.addEventListener('click', (event) => {
  if (event.target.tagName.toLowerCase() === 'img' && !event.target.classList.contains('no-modal')) {
    event.preventDefault();
    const photoUrl = event.target.src;
    const photoAlt = event.target.alt;
    if (event.target.width < 18 && event.target.height < 18) {
      return false;
    }
    window.WIKI.$root.$emit('openImageModal', photoUrl, photoAlt);
  }
});
