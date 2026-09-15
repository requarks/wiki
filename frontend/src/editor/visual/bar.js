/**
 * The floating bars the editor hangs off things that have no furniture of their own.
 *
 * A block node gets a header from its node view; a link mark and an image do not — one is a mark and
 * the other is a bare `<img>` — so each has a plugin that draws a small bar against the thing the
 * selection is on. What the two share is the button, which is where the one non-obvious rule lives.
 */

/** One button on a bar. */
export function barButton(label, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'visual-node-action'
  button.textContent = label
  /*
    The bar sits outside the editable, so clicking it would otherwise blur the editor and collapse the
    selection this whole thing is keyed on -- taking the bar away before the click landed.
  */
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', (event) => {
    event.preventDefault()
    onClick()
  })
  return button
}
