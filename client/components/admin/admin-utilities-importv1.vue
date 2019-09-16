<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subtitle-1 {{ $t('admin:utilities.importv1Title') }}
    v-card-text
      .text-center
        img.animated.fadeInUp.wait-p1s(src='/svg/icon-software.svg')
        .body-2 Import from Wiki.js 1.x
      v-divider.my-4
      .body-2 Data from a Wiki.js 1.x installation can easily be imported using this tool. What do you want to import?
      v-checkbox(
        label='Content'
        value='content'
        color='deep-orange darken-2'
        v-model='importFilters'
        hide-details
      )
      v-checkbox(
        label='Uploads'
        value='uploads'
        color='deep-orange darken-2'
        v-model='importFilters'
        hide-details
      )
      v-checkbox(
        label='Users'
        value='users'
        color='deep-orange darken-2'
        v-model='importFilters'
        hide-details
      )
      v-divider.my-5
      v-text-field.mt-3(
        outlined
        label='MongoDB Connection String'
        hint='The connection string to connect to the Wiki.js 1.x MongoDB database.'
        persistent-hint
        v-model='dbConnStr'
        v-if='needDB'
      )
      v-text-field.mt-3(
        outlined
        label='Content Repo Path'
        hint='The full path to where the Wiki.js 1.x content is stored on disk.'
        persistent-hint
        v-model='contentPath'
        v-if='needDisk'
      )
    v-card-chin
      v-btn.px-3(depressed, color='deep-orange darken-2', :disabled='!needDB && !needDisk', @click='startImport').ml-0
        v-icon(left, color='white') mdi-database-import
        span.white--text Start Import
    v-dialog(
      v-model='isLoading'
      persistent
      max-width='350'
      )
      v-card(color='deep-orange darken-2', dark)
        v-card-text.pa-10.text-center
          semipolar-spinner.animated.fadeIn(
            :animation-duration='1500'
            :size='65'
            color='#FFF'
            style='margin: 0 auto;'
          )
          .mt-5.body-1.white--text Importing from Wiki.js 1.x...
          .caption Please wait
</template>

<script>
import { SemipolarSpinner } from 'epic-spinners'

export default {
  components: {
    SemipolarSpinner
  },
  data() {
    return {
      importFilters: ['content', 'uploads', 'users'],
      dbConnStr: 'mongodb://',
      contentPath: '/wiki-v1/repo',
      isLoading: false
    }
  },
  computed: {
    needDB() {
      return this.importFilters.indexOf('users') >= 0
    },
    needDisk() {
      return this.importFilters.indexOf('content') >= 0 || this.importFilters.indexOf('uploads') >= 0
    }
  },
  methods: {
    async startImport () {
      this.isLoading = true
    }
  }
}
</script>

<style lang='scss'>

</style>
