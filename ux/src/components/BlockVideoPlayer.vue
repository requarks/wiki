<template lang="pug">
div(style='max-width: 760px;')
  Player(controls)
    Youtube(video-id='DyTCOwB0DVw', :autoplay='0')
    //- DefaultUi(noControls)
    //-   DefaultControls(
    //-     hideOnMouseLeave
    //-     :activeDuration='2000'
    //-   )
</template>

<script>
import '@vime/core/themes/default.css'
import { Player, Video, DefaultUi, DefaultControls, Youtube } from '@vime/vue-next'

export default {
  components: {
    Player,
    Video,
    DefaultUi,
    DefaultControls,
    Youtube
  }
}
</script>
