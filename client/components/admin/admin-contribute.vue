<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Contribute
        .subheading.grey--text Help support Wiki.js development and operations

      v-card.pa-3
        .body-1.pl-3 Wiki.js is a #[strong free and open-source software] brought to you with #[v-icon(color='red') favorite] by #[a(href='https://requarks.io', target='_blank') requarks.io] and #[a(href='https://github.com/Requarks/wiki/graphs/contributors', target='_blank') contributors].
        .body-1.pt-3.pl-3 We need your help to keep improving the software and run the various associated services (e.g. hosting and networking).
        v-divider
        v-subheader Fund our work
        .body-1.pl-3 Wiki.js is part of the Open Collective initiative. You can contribute financially by making a monthly or one-time donation:
        v-card-actions.mt-3.ml-2
          v-btn(depressed, color='primary', href='https://opencollective.com/wikijs')
            v-icon(left) local_atm
            | Make a donation
        v-divider
        v-subheader Contribute
        .body-1.pl-3
          ul
            li Submit an idea or vote on a proposed one on the #[a(href='https://requests.requarks.io/wiki', target='_blank') feature requests board].
            li Found a bug? Submit an issue on #[a(href='https://github.com/Requarks/wiki/issues', target='_blank') Github].
            li Help translate Wiki.js in your language. Let us know on #[a(href='https://gitter.im/Requarks/wiki', target='_blank') Gitter].
        v-divider
        v-subheader Spread the word
        .body-1.pl-3
          ul
            li Talk to your friends and colleagues about how awesome Wiki.js is!
            li Follow us on #[a(href='https://twitter.com/requarks', target='_blank') Twitter].

</template>

<script>
import IconGithubCircle from 'mdi/github-circle'

export default {
  components: {
    IconGithubCircle
  },
  data() {
    return {
      tab: '0',
      telemetry: true
    }
  },
  methods: {
    resetClientID() {

    }
  }
}
</script>

<style lang='scss' scoped>
ul {
  margin-left: 1rem;
  list-style-type: square;
}
</style>
