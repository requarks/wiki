/* THEME SPECIFIC JAVASCRIPT */

// Global "Open in modal" images events handler
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
