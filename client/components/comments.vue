<template lang="pug">
  div(v-intersect.once.quiet='onIntersect')
    v-textarea#discussion-new(
      outlined
      flat
      placeholder='Write a new comment...'
      auto-grow
      dense
      rows='3'
      hide-details
      v-model='newcomment'
      color='blue-grey darken-2'
      :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
    )
    .d-flex.align-center.pt-3
      v-icon.mr-1(color='blue-grey') mdi-language-markdown-outline
      .caption.blue-grey--text Markdown Format
      v-spacer
      v-btn(
        dark
        color='blue-grey darken-2'
        @click='postComment'
        depressed
        )
        v-icon(left) mdi-comment
        span.text-none Post Comment
    v-divider.mt-3
    .pa-5.d-flex.align-center.justify-center(v-if='isLoading')
      v-progress-circular(
        indeterminate
        size='20'
        width='1'
        color='blue-grey'
      )
      .caption.blue-grey--text.pl-3: em Loading comments...
    v-timeline(
      dense
      v-else-if='comments && comments.length > 0'
      )
      v-timeline-item(
        color='pink darken-4'
        large
        v-for='cm of comments'
        :key='`comment-` + cm.id'
        )
        template(v-slot:icon)
          v-avatar
            v-img(src='http://i.pravatar.cc/64')
        v-card.elevation-1
          v-card-text
            .caption: strong John Smith
            .overline.grey--text 3 minutes ago
            .mt-3 {{cm.render}}
    .pt-5.text-center.body-2.blue-grey--text(v-else) Be the first to comment.
</template>

<script>
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'

export default {
  data () {
    return {
      newcomment: '',
      isLoading: true,
      canFetch: false,
      comments: []
    }
  },
  computed: {
    pageId: get('page/id')
  },
  methods: {
    onIntersect () {
      this.isLoading = true
      this.canFetch = true
    },
    async postComment () {

    }
  },
  apollo: {
    comments: {
      query: gql`
        query ($pageId: Int!) {
          comments {
            list(pageId: $pageId) {
              id
              render
              authorName
              createdAt
              updatedAt
            }
          }
        }
      `,
      variables() {
        return {
          pageId: this.pageId
        }
      },
      skip () {
        return !this.canFetch
      },
      fetchPolicy: 'cache-and-network',
      update: (data) => data.comments.list,
      watchLoading (isLoading) {
        this.isLoading = isLoading
      }
    }
  }
}
</script>

<style lang="scss">

</style>
