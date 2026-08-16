<template lang="pug">
  v-card.page-tags-card(v-if='tags.length > 0', :class='cardClass')
    .pa-5
      .overline.teal--text.pb-2(:class='$vuetify.theme.dark ? `text--lighten-3` : ``') {{$t('common:page.tags')}}
      .page-tags-card__chips
        v-chip.mr-1.mb-1(
          label
          :color='$vuetify.theme.dark ? `teal darken-1` : `teal lighten-5`'
          v-for='tag in tags'
          :href='`/t/` + tag.tag'
          :key='`tag-` + tag.tag'
        )
          v-icon(:color='$vuetify.theme.dark ? `teal lighten-3` : `teal`', left, small) mdi-tag
          span(:class='$vuetify.theme.dark ? `teal--text text--lighten-5` : `teal--text text--darken-2`') {{tag.title}}
        v-chip.mr-1.mb-1(
          label
          :color='$vuetify.theme.dark ? `teal darken-1` : `teal lighten-5`'
          :href='`/t/` + tags.map(t => t.tag).join(`/`)'
          :aria-label='$t(`common:page.tagsMatching`)'
        )
          v-icon(:color='$vuetify.theme.dark ? `teal lighten-3` : `teal`', size='20') mdi-tag-multiple
</template>

<script>
export default {
  props: {
    tags: {
      type: Array,
      default: () => []
    },
    mobile: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    cardClass () {
      return this.mobile ? 'page-tags-card--mobile mb-4' : 'mb-5'
    }
  }
}
</script>

<style lang="scss">
.page-tags-card {
  &__chips {
    display: flex;
    flex-wrap: wrap;
  }

  &--mobile {
    margin-top: 24px;

    .page-tags-card__chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 4px;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }

      .v-chip {
        flex: 0 0 auto;
      }
    }
  }
}
</style>
