<template lang="pug">
  .page-embed.no-print(v-if='hasEmbed')
    .page-embed__archive(v-if='embed.archiveUrl')
      iframe.page-embed__iframe(
        :src='embed.archiveUrl'
        title='Document reader'
        loading='lazy'
        allowfullscreen
      )
    .page-embed__gdrive(v-else-if='embed.gdrivePreviewUrl || embed.gdriveUrl')
      iframe.page-embed__iframe(
        v-if='embed.gdrivePreviewUrl'
        :src='embed.gdrivePreviewUrl'
        title='Document preview'
        loading='lazy'
        allowfullscreen
      )
      .page-embed__gdrive-fallback(v-if='embed.gdriveUrl')
        v-btn.page-embed__gdrive-btn(
          color='primary'
          depressed
          :href='embed.gdriveUrl'
          target='_blank'
          rel='noopener'
        )
          v-icon(left) mdi-open-in-new
          span Open PDF on Google Drive
</template>

<script>
export default {
  props: {
    embed: {
      type: Object,
      default: null
    }
  },
  computed: {
    hasEmbed () {
      if (!this.embed) { return false }
      return !!(this.embed.archiveUrl || this.embed.gdriveUrl || this.embed.gdrivePreviewUrl)
    }
  }
}
</script>

<style lang="scss">
.page-embed {
  margin-top: 8px;
  margin-bottom: 8px;

  &__iframe {
    width: 100%;
    min-height: 75vh;
    height: 1000px;
    border: 0;
    display: block;
    background: #fff;
  }

  &__gdrive-fallback {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px 16px;
    text-align: center;
    background: #fff;
  }

  &__gdrive-text {
    margin: 0 0 12px;
    color: #444;
  }
}
</style>
