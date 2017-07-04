<template lang="pug">
  .container.is-fluid
    .columns.is-gapless

      .column.is-narrow.is-hidden-touch.sidebar
        aside.stickyscroll
          .sidebar-label
            span {{ $t('sidebar.pastversions') }}
          ul.sidebar-menu
            li(v-for='item in versions')
              a.is-multiline(:title='item.dateFull')
                span {{ item.dateCalendar }}
                span.is-small {{ item.commitAbbr }}

      .column
        .history
          .history-title {{ currentPath }}
          .history-info
            .columns
              .column.history-info-meta
                p
                  i.nc-icon-outline.ui-1_calendar-check-62
                  span Timestamp: #[strong 2017/07/02 5:19 PM]
                p
                  i.nc-icon-outline.i.nc-icon-outline.users_man-23
                  span Author: #[strong Nicolas Giard]
                p
                  i.nc-icon-outline.media-1_flash-21
                  span Commit: #[strong 379ff16957b2b7f978e02bfe50cd0cee182fcb8a]
              .column.history-info-actions
                .button-group
                  button.button.is-blue-grey()
                    i.nc-icon-outline.design_path-intersect
                    span Compare With...
                  button.button.is-blue-grey()
                    i.nc-icon-outline.ui-1_eye-17
                    span View
                  button.button.is-blue-grey()
                    i.nc-icon-outline.arrows-4_undo-29
                    span Revert to version
                toggle.is-dark(v-model='sidebyside', desc='Side-by-side View')
          .history-diff#diff

</template>

<script>
let diffui
export default {
  name: 'history',
  props: ['currentPath', 'historyData'],
  data() {
    return {
      versions: [],
      diffui: {},
      sidebyside: true
    }
  },
  watch: {
    sidebyside() {
      this.draw()
    }
  },
  methods: {
    draw() {
      diffui.draw('#diff', {
        inputFormat: 'json',
        outputFormat: this.sidebyside ? 'side-by-side' : 'line-by-line',
        matching: 'words',
        synchronisedScroll: true
      })
    }
  },
  mounted() {
    this.versions = JSON.parse(this.historyData)
    diffui = new Diff2HtmlUI({
      diff: `diff --git a/wiki/prerequisites.md b/wiki/prerequisites.md
index 89a10de..4bc0d66 100644
--- a/wiki/prerequisites.md
+++ b/wiki/prerequisites.md
@@ -13,7 +13,7 @@ Wiki.js runs on pretty much any platform that supports the requirements below. H

 **CPU:** Runs perfectly fine on a single CPU core machine. However, to maximize Wiki.js background agent feature, using 2 cores is highly recommended.

-**RAM:** Wiki.js uses between 100-200MB of RAM. While Wiki.js itself is able to run with only 512MB total RAM, you will not be able to install and compile the dependencies. You need a minimum of 768MB just to install the dependencies. Note that Windows machines may require more RAM.
+**RAM:** Wiki.js uses between 100-200MB of RAM. While Wiki.js itself is able to run with only 512MB total RAM, you will not be able to install all the dependencies. You need a minimum of 768MB just to install the dependencies. Note that Windows machines may require more RAM.

 **Disk Space:** Wiki.js requires about 300MB of disk space when including the dependencies. The actual total space needed for your installation depends on the content and most importantly, the uploads. A wiki with only text content will only use a few megabytes, even for thousands of articles. However, if you start adding images, documents, videos, etc., you must plan required disk space accordingly.
`
    })
    this.draw()
  }
}
</script>
