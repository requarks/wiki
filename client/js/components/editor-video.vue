<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-green
              span {{ $t('editor.videotitle') }}
            section
              label.label
              p.control.is-fullwidth
                input.input(type='text', placeholder='https://www.youtube.com/watch?v=xxxxxxxxxxx', v-model='link', ref='editorVideoInput', @keyup.enter='insertVideo', @keyup.esc='cancel')
                span.help.is-red(v-show='isInvalid') {{ $t('editor.videonotsupported') }}
              .note {{ $t('editor.videosupportedtitle') }}
                ul
                  li
                    i.icon-youtube-play
                    span Youtube
                  li
                    i.icon-vimeo
                    span Vimeo
                  li
                    i.nc-icon-outline.media-1_play-69
                    span Dailymotion
                  li
                    i.icon-video
                    span {{ $t('editor.videoanymp4file') }}
            footer
              a.button.is-grey.is-outlined(v-on:click='cancel') {{ $t('editor.discard') }}
              a.button.is-green(v-on:click='insertVideo') {{ $t('editor.videoinsert') }}
</template>

<script>
  const videoRules = {
    'youtube': new RegExp(/(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/, 'i'),
    'vimeo': new RegExp(/vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|)(\d+)(?:$|\/|\?)/, 'i'),
    'dailymotion': new RegExp(/(?:dailymotion\.com(?:\/embed)?(?:\/video|\/hub)|dai\.ly)\/([0-9a-z]+)(?:[-_0-9a-zA-Z]+(?:#video=)?([a-z0-9]+)?)?/, 'i')
  }

  export default {
    name: 'editor-video',
    data () {
      return {
        link: '',
        isInvalid: false
      }
    },
    computed: {
      isShown () {
        return this.$store.state.editorVideo.shown
      }
    },
    methods: {
      init () {
        let self = this
        self.isInvalid = false
        self._.delay(() => {
          self.$refs.editorVideoInput.focus()
        }, 100)
      },
      cancel () {
        this.$store.dispatch('editorVideo/close')
      },
      insertVideo () {
        let self = this

        if (this._.isEmpty(self.link) || self.link.length < 5) {
          this.isInvalid = true
          return
        }

        let videoType = this._.findKey(videoRules, (vr) => {
          return vr.test(self.link)
        })
        if (this._.isNil(videoType)) {
          videoType = 'video'
        }
        let videoText = '[video](' + this.link + '){.' + videoType + '}\n'
        this.$store.dispatch('editor/insert', videoText)
        this.$store.dispatch('alert', {
          style: 'blue',
          icon: 'media-1_action-74',
          msg: self.$t('editor.videosuccess')
        })
        this.cancel()
      }
    },
    mounted () {
      this.$root.$on('editorVideo/init', this.init)
    }
  }
</script>
