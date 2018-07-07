<template lang='pug'>
  v-card(flat)
    v-card(flat, tile, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"').pa-3.pt-4
      .headline.primary--text {{ $t('admin:contribute.title') }}
      .subheading.grey--text {{ $t('admin:contribute.subtitle') }}
    v-card.pa-3
      i18next.body-1.pl-3(path='admin:contribute.openSource', tag='div')
        v-icon(color='red') favorite
        a(href='https://requarks.io', target='_blank') requarks.io
        a(href='https://github.com/Requarks/wiki/graphs/contributors', target='_blank') {{ $t('admin:contribute.openSourceContributors') }}
      .body-1.pt-3.pl-3 {{ $t('admin:contribute.needYourHelp') }}
      v-divider
      v-subheader {{ $t('admin:contribute.fundOurWork') }}
      .body-1.pl-3 {{ $t('admin:contribute.openCollective') }}
      v-card-actions.mt-3.ml-2
        v-btn(depressed, color='primary', href='https://opencollective.com/wikijs')
          v-icon(left) local_atm
          span {{ $t('admin:contribute.makeADonation') }}
      v-divider
      v-subheader {{ $t('admin:contribute.contribute') }}
      .body-1.pl-3
        ul
          i18next(path='admin:contribute.submitAnIdea', tag='li')
            a(href='https://requests.requarks.io/wiki', target='_blank') {{ $t('admin:contribute.submitAnIdeaLink') }}
          i18next(path='admin:contribute.foundABug', tag='li')
            a(href='https://github.com/Requarks/wiki/issues', target='_blank') Github
          i18next(path='admin:contribute.helpTranslate', tag='li')
            a(href='https://gitter.im/Requarks/wiki', target='_blank') Gitter
      v-divider
      v-subheader {{ $t('admin:contribute.spreadTheWord') }}
      .body-1.pl-3
        ul
          li {{ $t('admin:contribute.talkToFriends') }}
          i18next(path='admin:contribute.followUsOnTwitter', tag='li')
            a(href='https://twitter.com/requarks', target='_blank') Twitter

</template>

<script>
export default {
}
</script>

<style lang='scss' scoped>
ul {
  margin-left: 1rem;
  list-style-type: square;
}
</style>
