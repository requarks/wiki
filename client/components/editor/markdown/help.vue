<template lang='pug'>
  v-card.editor-markdown-help.animated.fadeInLeft(flat, tile)
    v-container.pa-3(grid-list-lg, fluid)
      v-layout(row, wrap)
        v-flex(xs12, lg6, xl4)
          v-card.radius-7.animated.fadeInUp(light)
            v-card-text
              .d-flex
                v-toolbar.radius-7(color='teal lighten-5', dense, flat, height='44')
                  v-icon.mr-3(color='teal') mdi-information-variant
                  .body-2.teal--text Markdown Reference
              .body-2.mt-3 Bold
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div **Lorem ipsum**
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      .caption: strong Lorem ipsum
              .body-2.mt-3 Italic
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div *Lorem ipsum*
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      .caption: em Lorem ipsum
              .body-2.mt-3 Strikethrough
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div ~~Lorem ipsum~~
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      .caption(style='text-decoration: line-through;') Lorem ipsum
              .body-2.mt-3 Headers
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div # Header 1
                      div ## Header 2
                      div ### Header 3
                      div #### Header 4
                      div ##### Header 5
                      div ###### Header 6
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      div(style='font-weight: 700; font-size: 24px;') Header 1
                      div(style='font-weight: 700; font-size: 22px;') Header 2
                      div(style='font-weight: 700; font-size: 20px;') Header 3
                      div(style='font-weight: 700; font-size: 18px;') Header 4
                      div(style='font-weight: 700; font-size: 16px;') Header 5
                      div(style='font-weight: 700; font-size: 14px;') Header 6
              .body-2.mt-3 Unordered Lists
              .caption.grey--text.text--darken-1: em You can also use the asterisk symbol instead of the dash.
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div - Unordered List Item 1
                      div - Unordered List Item 2
                      div - Unordered List Item 3
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      ul
                        li Unordered List Item 1
                        li Unordered List Item 2
                        li Unordered List Item 3
              .body-2.mt-3 Ordered Lists
              .caption.grey--text.text--darken-1: em Even though we prefix all lines with #[strong 1.], the output will be correctly numbered automatically.
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div 1. Ordered List Item 1
                      div 1. Ordered List Item 2
                      div 1. Ordered List Item 3
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      ol
                        li Unordered List Item 1
                        li Unordered List Item 2
                        li Unordered List Item 3
              .body-2.mt-3 Images
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div ![Caption Text](/path/to/image.jpg)
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      img(src='https://via.placeholder.com/150x50.png')
        v-flex(xs12, lg6, xl4)
          v-card.radius-7.animated.fadeInUp.wait-p1s(light)
            v-card-text
              .d-flex
                v-toolbar.radius-7(color='teal lighten-5', dense, flat, height='44')
                  v-icon.mr-3(color='teal') mdi-information-variant
                  .body-2.teal--text Markdown Reference (continued)
              .body-2.mt-3 Links
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div [Link Text](https://wiki.js.org)
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      .caption: a(href='https://wiki.js.org', target='_blank') Link Text
              .body-2.mt-3 Superscript
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div Lorem ^ipsum^
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      .caption Lorem #[sup ipsum]
              .body-2.mt-3 Subscript
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div Lorem ~ipsum~
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      .caption: em Lorem #[sub ipsum]
              .body-2.mt-3 Horizontal Line
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div Lorem ipsum
                      div ---
                      div Dolor sit amet
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      .caption Lorem ipsum
                      v-divider.my-2
                      .caption Dolor sit amet
              .body-2.mt-3 Inline Code
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div Lorem `ipsum dolor sit` amet
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      .caption Lorem #[code ipsum dolor sit] amet
              .body-2.mt-3 Code Blocks
              .caption.grey--text.text--darken-1: em In the example below, #[strong js] defines the syntax highlighting language to use. It can be omitted.
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div ```js
                      div function main () {
                      div.pl-3 echo 'Lorem ipsum'
                      div }
                      div ```
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text.contents
                      pre.prismjs.line-numbers.language-js
                        code.language-js
                          span.token.keyword function
                          span.token.function  main
                          span.token.punctuation  (
                          span.token.punctuation )
                          span.token.punctuation  {#[br]
                          |   echo
                          span.token.string  'Lorem ipsum'#[br]
                          span.token.punctuation }
                          span.line-numbers-rows(aria-hidden='true')
                            span
                            span
                            span
              .body-2.mt-3 Blockquotes
              v-layout(row)
                v-flex(xs6)
                  v-card.editor-markdown-help-source(flat)
                    v-card-text
                      div &gt; Lorem ipsum
                      div &gt; dolor sit amet
                      div &gt; consectetur adipiscing elit
                v-icon mdi-chevron-right
                v-flex
                  v-card.editor-markdown-help-result(flat)
                    v-card-text
                      blockquote(style='border: 1px solid #263238; border-radius: .5rem; padding: 1rem 24px;') Lorem ipsum#[br]dolor sit amet#[br]consectetur adipiscing elit

        v-flex(xs12, xl4)
          v-card.radius-7.animated.fadeInUp.wait-p2s(light)
            v-card-text
              v-toolbar.radius-7(color='teal lighten-5', dense, flat)
                v-icon.mr-3(color='teal') mdi-keyboard
                .body-2.teal--text Keyboard Shortcuts
              v-list.editor-markdown-help-kbd(two-line, dense)
                v-list-item
                  v-list-item-content.body-2 Bold
                  v-list-item-action #[kbd {{ctrlKey}}] + #[kbd B]
                v-divider
                v-list-item
                  v-list-item-content.body-2 Italic
                  v-list-item-action #[kbd {{ctrlKey}}] + #[kbd I]
                v-divider
                v-list-item
                  v-list-item-content.body-2 Increase Header Level
                  v-list-item-action #[kbd {{ctrlKey}}] + #[kbd {{altKey}}] + #[kbd Right]
                v-divider
                v-list-item
                  v-list-item-content.body-2 Decrease Header Level
                  v-list-item-action #[kbd {{ctrlKey}}] + #[kbd {{altKey}}] + #[kbd Left]
                v-divider
                v-list-item
                  v-list-item-content.body-2 Save
                  v-list-item-action #[kbd {{ctrlKey}}] + #[kbd S]
                v-divider
                v-list-item
                  v-list-item-content.body-2 Undo
                  v-list-item-action #[kbd {{ctrlKey}}] + #[kbd Z]
                v-divider
                v-list-item
                  v-list-item-content.body-2 Redo
                  v-list-item-action #[kbd {{ctrlKey}}] + #[kbd Y]
                v-divider
                v-list-item
                  v-list-item-content
                    v-list-item-title.body-2 Distraction Free Mode
                    v-list-item-subtitle Press <kbd>Esc</kbd> to exit.
                  v-list-item-action #[kbd F11]

          v-card.radius-7.animated.fadeInUp.wait-p3s.mt-3(light)
            v-card-text
              v-toolbar.radius-7(color='teal lighten-5', dense, flat)
                v-icon.mr-3(color='teal') mdi-mouse
                .body-2.teal--text Multi-Selection
              v-list.editor-markdown-help-kbd(two-line, dense)
                v-list-item
                  v-list-item-content.body-2 Multiple Cursors
                  v-list-item-action #[kbd {{ctrlKey}}] + Left Click
                v-divider
                v-list-item
                  v-list-item-content.body-2 Select Region
                  v-list-item-action #[kbd {{ctrlKey}}] + #[kbd {{altKey}}] + Left Click
                v-divider
                v-list-item
                  v-list-item-content.body-2 Deselect
                  v-list-item-action #[kbd Esc]
</template>

<script>
export default {
  computed: {
    ctrlKey() { return /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl' },
    altKey() { return /Mac/.test(navigator.platform) ? 'Option' : 'Alt' }
  }
}
</script>

<style lang='scss'>
.editor-markdown-help {
  position: fixed !important;
  top: 112px;
  left: 64px;
  z-index: 10;
  width: calc(100vw - 64px - 17px);
  height: calc(100vh - 112px - 24px);
  background-color: rgba(darken(mc('grey', '900'), 3%), .9) !important;
  overflow: auto;

  &-source {
    background-color: mc('blue-grey', '900') !important;
    border-radius: 7px;
    font-family: 'Roboto Mono', monospace;
    font-size: 14px;
    color: #FFF !important;

    .v-card__text {
      color: #FFF !important;
    }
  }

  &-result {
    background-color: mc('blue-grey', '50') !important;
    border-radius: 7px;
    font-size: 14px;

    code {
      display: inline-block;
      background-color: mc('pink', '50');
      box-shadow: none;
      font-size: inherit;
    }

    .contents {
      padding-bottom: 16px;
    }

    .prismjs {
      margin: 0;
    }
  }

  &-kbd {
    .v-list-item__action {
      flex-direction: row;
      align-items: center;

      kbd {
        display: inline-block;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 0.1em 0.5em;
        margin: 0 0.2em;
        box-shadow: 0 1px 0px rgba(0, 0, 0, 0.2), 0 0 0 2px #fff inset;
        background-color: #f7f7f7;
        color: mc('grey', '700');
        font-size: 12px;
      }
    }
  }
}
</style>
