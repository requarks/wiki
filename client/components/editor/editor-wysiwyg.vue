<template lang='pug'>
  .editor-wysiwyg
    div(ref='editor')

</template>

<script>
import 'grapesjs/dist/css/grapes.min.css'
import grapesjs from 'grapesjs'

let editor

export default {
  mounted() {
    editor = grapesjs.init({
      container: this.$refs.editor,
      width: 'auto',
      height: 'calc(100vh - 64px)',
      storageManager: { type: null },
      // panels: { defaults: [] }
      blockManager: {
        blocks: [
          {
            id: 'section', // id is mandatory
            label: '<b>Section</b>', // You can use HTML/SVG inside labels
            attributes: { class: 'gjs-block-section' },
            content: `<section>
              <h1>This is a simple title</h1>
              <div>This is just a Lorem text: Lorem ipsum dolor sit amet</div>
            </section>`
          }, {
            id: 'text',
            label: 'Text',
            content: '<div data-gjs-type="text">Insert your text here</div>',
          }, {
            id: 'image',
            label: 'Image',
            // Select the component once it's dropped
            select: true,
            // You can pass components as a JSON instead of a simple HTML string,
            // in this case we also use a defined component type `image`
            content: { type: 'image' },
            // This triggers `active` event on dropped components and the `image`
            // reacts by opening the AssetManager
            activate: true
          }
        ]
      }
    })
  }
}
</script>

<style lang="scss">

.gjs-block {
  width: auto;
  height: auto;
  min-height: auto;
}

</style>
