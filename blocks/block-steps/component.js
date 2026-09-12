/**
 * Block Steps
 *
 * A list drawn as a sequence: every item is numbered in a disc of its own, with a line running from
 * one disc down to the next, so that a procedure reads as one path through the page rather than as a
 * list that happens to be numbered.
 *
 * It draws none of that, and has no shadow root at all. What the block holds is the author's own
 * markdown list, and a list is page content — styled, spaced and coloured by the article's own
 * stylesheet, which is also the only thing that can reach the items: slotted into a shadow root, an
 * `<ol>` puts its `<li>` elements two levels below the host, where `::slotted()` does not follow. So
 * the appearance lives with the rest of the list typography, in `frontend/src/css/_page-contents.scss`,
 * for the same reason `block-tab`'s does.
 *
 * That leaves this file the declaration, and the one number CSS cannot work out for itself.
 *
 * It is registered as an element of its own so that the page view, which fetches a component for
 * every undefined element it finds in a page, has something to fetch.
 */
export class BlockStepsElement extends HTMLElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   *
   * No props: what a step says, how many there are and what order they come in are all in the body,
   * which is the list itself. `template` is the body the picker writes into the page along with the
   * opening line — a loose list, since the second line of a step is the part an author has to be
   * shown is possible.
   */
  static definition = {
    block: 'steps',
    name: 'Steps',
    description: 'Draws a numbered list as a sequence of steps.',
    icon: 'list',
    template: `1. First step

   What to do, and anything else that belongs with it.

2. Second step

   What to do next.

3. Done`
  }

  connectedCallback() {
    /*
      A box of its own, set inline because the app resets the display of everything in a page and an
      unknown element is inline to begin with. Stated here as well as in the stylesheet so that the
      list is a block on its own line even in a document the stylesheet has not reached — the
      prerendered copy the server puts in the page for a reader with no JavaScript is styled by
      neither, but that copy never runs this either, and there the `<ol>` is a block in its own right.
    */
    if (!this.style.display) {
      this.style.display = 'block'
    }
    this._applyStart()
  }

  /**
   * Carry an ordered list's own starting number onto the counter the discs are numbered from.
   *
   * The numbers are a CSS counter and not the list's markers, because a marker cannot be given a
   * shape to sit in — and a counter starts at one whatever the list it is counting says. A list
   * written `4.` `5.` `6.` is `<ol start="4">`, which is an author saying these steps carry on from
   * somewhere, so the counter starts where the list does. Nothing to do for the usual case: a list
   * starting at one carries no attribute at all, and the stylesheet's own reset is already right.
   *
   * Inline on the list, which is where the stylesheet puts the reset it overrides.
   */
  _applyStart() {
    const list = this.querySelector(':scope > ol[start]')
    const start = Number.parseInt(list?.getAttribute('start') ?? '', 10)
    if (list && Number.isFinite(start)) {
      list.style.setProperty('counter-reset', `wiki-step ${start - 1}`)
    }
  }
}

window.customElements.define('block-steps', BlockStepsElement)
