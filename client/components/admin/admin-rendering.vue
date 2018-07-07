<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text Rendering
        .subheading.grey--text Configure how content is rendered
        v-layout.mt-3(row wrap)
          v-flex(lg3 xs12)
            v-card
              v-toolbar(
                color='primary'
                dense
                flat
                dark
                )
                v-icon.mr-2 line_weight
                .subheading Pipeline
              v-toolbar(
                color='blue'
                dense
                dark
                )
                v-icon.mr-2 arrow_downward
                .body-2 Markdown
                v-spacer
                v-btn(
                  icon
                  @click=''
                  )
                  v-icon add
              v-list(two-line, dense)
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') crop_free
                  v-list-tile-content
                    v-list-tile-title Core
                    v-list-tile-sub-title Basic Markdown parser
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') tag_faces
                  v-list-tile-content
                    v-list-tile-title Emoji
                    v-list-tile-sub-title Convert tags to emojis
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') list
                  v-list-tile-content
                    v-list-tile-title Task Lists
                    v-list-tile-sub-title Parse task lists to checkboxes
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') multiline_chart
                  v-list-tile-content
                    v-list-tile-title PlantUML
                    v-list-tile-sub-title Generate diagrams from PlantUML syntax
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') merge_type
                  v-list-tile-content
                    v-list-tile-title Mermaid
                    v-list-tile-sub-title Generate flowcharts from Mermaid syntax
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') functions
                  v-list-tile-content
                    v-list-tile-title Mathjax Pre-Processor
                    v-list-tile-sub-title Parse Mathjax content from Markdown
                  v-list-tile-avatar
                    v-icon(color='red', small) trip_origin

              v-toolbar(
                color='blue'
                dense
                dark
                )
                v-icon.mr-2 arrow_downward
                .body-2 HTML
                v-spacer
                v-btn(
                  icon
                  @click=''
                  )
                  v-icon add
              v-list(two-line, dense)
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') subscriptions
                  v-list-tile-content
                    v-list-tile-title Video Players
                    v-list-tile-sub-title Embed video players such as Youtube, Vimeo, etc.
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') subtitles
                  v-list-tile-content
                    v-list-tile-title Asciinema
                    v-list-tile-sub-title Embed asciinema players from compatible links
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') volume_up
                  v-list-tile-content
                    v-list-tile-title Audio Players
                    v-list-tile-sub-title Embed audio players for audio content
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') insert_comment
                  v-list-tile-content
                    v-list-tile-title Blockquotes
                    v-list-tile-sub-title Process styled blockquotes
                  v-list-tile-avatar
                    v-icon(color='green', small) lens
                v-divider.my-0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon(color='grey') functions
                  v-list-tile-content
                    v-list-tile-title Mathjax Processor
                    v-list-tile-sub-title TeX/MathML Math Equations Parser
                  v-list-tile-avatar
                    v-icon(color='red', small) trip_origin

          v-flex(lg9 xs12)
            v-card
              v-toolbar(
                color='grey darken-1'
                dark
                flat
                dense
                )
                v-icon.mr-2 settings_applications
                .subheading Markdown
                v-icon chevron_right
                .subheading Core
                v-spacer
                v-btn(flat, disabled)
                  v-icon(left) wrap_text
                  span Bypass
                v-btn(flat, disabled)
                  v-icon(left) clear
                  span Remove
              v-card-text
                v-switch(
                  v-model='linkify'
                  label='Automatically convert links'
                  color='primary'
                  persistent-hint
                  hint='Links will automatically be converted to clickable links.'
                  )
                v-divider
                v-switch(
                  v-model='linkify'
                  label='Automatically convert line breaks'
                  color='primary'
                  persistent-hint
                  hint='Add linebreaks within paragraphs.'
                  )
                v-divider
                v-switch(
                  v-model='linkify'
                  label='Highlight code blocks'
                  color='primary'
                  persistent-hint
                  hint='Add syntax coloring to code blocks.'
                  )
                v-select.mt-3(
                  :items='["Light", "Dark"]'
                  v-model='codeTheme'
                  label='Code Color Theme'
                  outline
                  background-color='grey lighten-2'
                )
              v-card-chin
                v-btn(
                  color='primary'
                  )
                  v-icon(left) check
                  span Apply Configuration
</template>

<script>
export default {
  data() {
    return {
      linkify: true,
      codeTheme: 'Light'
    }
  }
}
</script>

<style lang='scss'>

</style>
