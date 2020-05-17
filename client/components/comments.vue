<template lang="pug">
  div
    v-textarea#discussion-new(
      solo
      flat
      placeholder='Write a new comment...'
      auto-grow
      dense
      rows='3'
      hide-details
    )
    .d-flex.align-center.pt-3
      v-icon.mr-1(color='blue-grey') mdi-language-markdown-outline
      .caption.blue-grey--text Markdown Format
      v-spacer
      v-btn(
        dark
        color='pink darken-4'
        )
        v-icon(left) mdi-comment
        span Post Comment
    v-divider.mt-3
    v-timeline(
      dense
      )
      v-timeline-item(
        color='pink darken-4'
        large
        )
        template(v-slot:icon)
          v-avatar
            v-img(src='http://i.pravatar.cc/64')
        v-card.elevation-1
          v-card-text
            .caption: strong John Smith
            .overline.grey--text 3 minutes ago
            .mt-3 Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec sem arcu, mollis et erat quis, convallis tempor urna. In dictum pharetra consequat. #[br] #[br] Integer placerat ultrices nisl eget tincidunt. Curabitur sagittis tortor ut libero semper, et mollis odio ultrices. Sed consectetur sollicitudin ipsum, in commodo augue.
      v-timeline-item(
        color='pink darken-4'
        large
        )
        template(v-slot:icon)
          v-avatar
            v-img(src='http://i.pravatar.cc/32')
        v-card.elevation-1
          v-card-text
            .caption: strong Nikola Tesla
            .overline.grey--text Yesterday at 8:03 AM
            .mt-3 Integer placerat ultrices nisl eget tincidunt. Curabitur sagittis tortor ut libero semper, et mollis odio ultrices. Sed consectetur sollicitudin ipsum, in commodo augue. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec sem arcu, mollis et erat quis, convallis tempor urna. In dictum pharetra consequat.
</template>

<script>
export default {

}
</script>

<style lang="scss">

</style>
