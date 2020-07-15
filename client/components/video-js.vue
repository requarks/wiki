<template>
  <div>
    <video
      ref="videoPlayer"
      class="video-js vjs-default-skin vjs-big-play-centered"
    />
  </div>
</template>

<script>
import videojs from 'video.js'

export default {
  name: 'VideoJS',
  props: {
    options: {
      type: Object,
      default() {
        return {}
      }
    }
  },
  data() {
    return {
      player: null
    }
  },
  mounted() {
    this.player = videojs(this.$refs.videoPlayer, this.options)
    // Disabling context menu
    if (this.$refs.videoPlayer.addEventListener) {
      this.$refs.videoPlayer.addEventListener('contextmenu', function(e) {
        e.preventDefault()
      }, false)
    } else {
      this.$refs.videoPlayer.attachEvent('oncontextmenu', function() {
        window.event.returnValue = false
      })
    }
  },
  beforeDestroy() {
    if (this.player) {
      this.player.dispose()
    }
  }
}
</script>

<style>
  @import '../../node_modules/video.js/dist/video-js.css';
</style>
