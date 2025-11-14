<template lang='pug'>
  v-card.editor-modal-drawio.animated.fadeIn(flat, tile)
    iframe(
      ref='drawio'
      :src='drawioBaseUrl'
      frameborder='0'
    )
</template>

<script>
import { sync, get } from 'vuex-pathify'

export default {
  data() {
    return {
      content: ''
    }
  },
  computed: {
    editorKey: get('editor/editorKey'),
    activeModal: sync('editor/activeModal'),
    drawioBaseUrl() {
      return `${siteConfig.drawio.baseUrl}?embed=1&proto=json&spin=1&saveAndExit=1&noSaveBtn=1&noExitBtn=0`
    }
  },
  methods: {
    close () {
      this.activeModal = ''
    },
    overwriteAndClose() {
      this.$root.$emit('overwriteEditorContent')
      this.$root.$emit('resetEditorConflict')
      this.close()
    },
    send (msg) {
      this.$refs.drawio.contentWindow.postMessage(JSON.stringify(msg), '*')
    },
    receive (evt) {
      if (evt.frame === null || evt.source !== this.$refs.drawio.contentWindow || evt.data.length < 1) {
        return
      }
      try {
        const msg = JSON.parse(evt.data)
        switch (msg.event) {
          case 'init': {
            this.send({
              action: 'load',
              autosave: 0,
              modified: 'unsavedChanges',
              xml: this.$store.get('editor/activeModalData'),
              title: this.$store.get('page/title')
            })
            this.$store.set('editor/activeModalData', null)
            break
          }
          case 'configure': {
            this.send({
              action: 'configure',
              config: {
                showStartScreen: true
              }
            })
            break
          }
          case 'save': {
            if (msg.exit) {
              this.send({
                action: 'export',
                format: 'xmlsvg'
              })
            }
            break
          }
          case 'export': {
            const svgDataStart = msg.data.indexOf('base64,') + 7
            this.$root.$emit('editorInsert', {
              kind: 'DIAGRAM',
              text: msg.data.slice(svgDataStart)
            })
            this.close()
            break
          }
          case 'exit': {
            this.close()
            break
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
  },
  async mounted () {
    window.addEventListener('message', this.receive)
  },
  beforeDestroy () {
    window.removeEventListener('message', this.receive)
  }
}
</script>

<style lang='scss'>
.editor-modal-drawio {
  position: fixed !important;
  top: 0;
  left: 0;
  z-index: 10;
  width: 100%;
  height: 100vh;
  background-color: rgba(255,255,255, 1) !important;
  overflow: hidden;

  > iframe {
    width: 100%;
    height: 100vh;
    border: 0;
    padding: 0;
    background-color: #FFF;
  }
}
</style>
