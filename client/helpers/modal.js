window.onload = function() {
  const lightboxImages = window.document.querySelectorAll('.modal')

  lightboxImages.forEach(img => {
    img.addEventListener('click', e => {
      e.preventDefault()

      const imageContainer = document.createElement('div')
      imageContainer.classList.add('image-modal-popup')

      const closeButton = document.createElement('div')
      closeButton.className = ('image-modal-popup-close')
      closeButton.innerHTML = '<i aria-hidden="true" class="v-icon notranslate mdi mdi-close"></i>'
      closeButton.setAttribute('data-img', img.href)

      const image = document.createElement('img')

      let href = img.href
      if (!href) {
        href = img.getAttribute('src')
      }

      image.src = href
      image.classList.add('modal-image')

      imageContainer.appendChild(image)
      imageContainer.appendChild(closeButton)

      imageContainer.addEventListener('click', function handleClick(event) {
        imageContainer.remove()
      })

      document.querySelector('.v-main').appendChild(imageContainer)
    })
  })
}
