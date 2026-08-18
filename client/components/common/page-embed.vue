<template lang="pug">
  .page-embed.no-print(v-if='hasEmbed', :class='{ "page-embed--compact": isCompactEmbed }', :style='embedStyleVars')
    .page-embed__archive(v-if='embed.archiveUrl')
      .page-embed__frame
        iframe.page-embed__iframe(
          :src='embed.archiveUrl'
          title='Document reader'
          loading='lazy'
          allowfullscreen
        )
    .page-embed__gdrive(v-else-if='embed.gdrivePreviewUrl || embed.gdriveUrl')
      .page-embed__frame(v-if='embed.gdrivePreviewUrl')
        iframe.page-embed__iframe(
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
const DEFAULT_IFRAME_SETTINGS = {
  desktopHeightPx: 1000,
  desktopMinHeightVh: 75,
  mobileHeightPx: 480,
  mobileMaxHeightVh: 60
}

export default {
  props: {
    embed: {
      type: Object,
      default: null
    },
    iframeSettings: {
      type: Object,
      default: null
    }
  },
  computed: {
    hasEmbed () {
      if (!this.embed) { return false }
      return !!(this.embed.archiveUrl || this.embed.gdriveUrl || this.embed.gdrivePreviewUrl)
    },
    isCompactEmbed () {
      return this.$vuetify.breakpoint.smAndDown
    },
    resolvedIframeSettings () {
      return {
        ...DEFAULT_IFRAME_SETTINGS,
        ...(this.iframeSettings || {})
      }
    },
    embedStyleVars () {
      const settings = this.resolvedIframeSettings
      return {
        '--page-embed-desktop-height': `${settings.desktopHeightPx}px`,
        '--page-embed-desktop-min-height': `${settings.desktopMinHeightVh}vh`,
        '--page-embed-mobile-height': `${settings.mobileHeightPx}px`,
        '--page-embed-mobile-max-height-vh': `${settings.mobileMaxHeightVh}vh`
      }
    }
  }
}
</script>

<style lang="scss">
.page-embed {
  margin-top: 8px;
  margin-bottom: 8px;

  &__frame {
    width: 100%;
  }

  &__iframe {
    width: 100%;
    min-height: var(--page-embed-desktop-min-height, 75vh);
    height: var(--page-embed-desktop-height, 1000px);
    border: 0;
    display: block;
    background: #fff;
  }

  &--compact {
    .page-embed__frame {
      overflow: hidden;
      overscroll-behavior: contain;
      border-radius: 4px;
      height: min(var(--page-embed-mobile-max-height-vh, 60vh), var(--page-embed-mobile-height, 480px));
    }

    .page-embed__iframe {
      min-height: 0;
      height: 100%;
    }
  }

  &__gdrive-fallback {
    border: 1px solid mc('grey', '300');
    border-radius: 8px;
    padding: 20px 16px;
    text-align: center;
    background: #fff;
  }

  &__gdrive-text {
    margin: 0 0 12px;
    color: mc('grey', '800');
  }
}
</style>
