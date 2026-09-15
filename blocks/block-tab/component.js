/**
 * Block Tab
 *
 * One panel of a `block-tabs`. It draws nothing and knows nothing: the parent reads its `label` and
 * `icon`, builds the strip from them and shows or hides it. Its content is ordinary page content,
 * left in the light DOM so the article's own stylesheet reaches it.
 *
 * `header` is read by neither of them. A tab's label is an attribute rather than text, so there is no
 * heading in the render for a contents list to find, and the server closes that gap when the page is
 * saved: it anchors this element and lists the label at the level asked for (`anchorHeadings` in
 * `models/rendering.ts`). A reader clicking that row is sent here, and the panel is opened on the way
 * by the `block-reveal` every anchor already asks for.
 *
 * It is registered as an element of its own so that the page view, which fetches a component for
 * every undefined element it finds in a page, has something to fetch.
 */
export class BlockTabElement extends HTMLElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   *
   * `isChild` keeps it out of both: a tab on its own is not something to insert into a page, and not
   * something to switch off separately from the tabs it belongs to. The definition is still what
   * lets the tag and its attributes survive being saved, which is the reason it is declared at all.
   */
  static definition = {
    block: 'tab',
    name: 'Tab',
    description: 'One panel of a set of tabs.',
    icon: 'subtitles',
    isChild: true,
    props: [
      {
        name: 'label',
        type: 'string',
        label: 'Label',
        hint: 'What the tab is called in the strip.',
        required: true
      },
      {
        /*
          `icon` rather than `string`: the value is an Iconify reference, which is something to pick
          rather than to spell, and the editor offers the same picker the rest of the app uses.
        */
        name: 'icon',
        type: 'icon',
        label: 'Icon',
        hint: 'Iconify reference drawn to the left of the label, e.g. mdi:language-python.'
      },
      {
        /*
          The level this tab is listed at in the page contents, as a choice rather than a number:
          `anchorHeadings` accepts `1`-`6` and nothing else, so a free number field could only be
          filled in wrongly. The empty value is what "Normal" means -- no attribute is written for it,
          and the tab is an ordinary tab.
        */
        name: 'header',
        type: 'select',
        label: 'Header Level',
        hint: 'Lists this tab in the page contents under its label, at the level chosen. A reader clicking it there opens the tab.',
        default: '',
        options: [
          { label: 'Normal', value: '' },
          { label: 'Heading 1', value: '1' },
          { label: 'Heading 2', value: '2' },
          { label: 'Heading 3', value: '3' },
          { label: 'Heading 4', value: '4' },
          { label: 'Heading 5', value: '5' },
          { label: 'Heading 6', value: '6' }
        ]
      }
    ]
  }

  connectedCallback() {
    /*
      A box of its own, set inline because the app resets the display of everything in a page.

      Only when nothing has been set already: the two components arrive in separate files and in
      either order, and whichever runs second must not undo the first. The parent hides the panels it
      is not showing, so overwriting that here would leave every panel on screen at once.

      Visible rather than hidden by default, so a page whose tab strip never arrives is a page with
      all its content stacked up and readable, rather than a page with none of it.
    */
    if (!this.style.display) {
      this.style.display = 'block'
    }
  }
}

window.customElements.define('block-tab', BlockTabElement)
