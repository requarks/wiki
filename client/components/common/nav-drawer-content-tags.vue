<template lang='pug'>
  v-list(dense, nav, :dark='drawerDark')
    v-list-item(href='/', @click='onNavigate')
      v-list-item-icon: v-icon(:color='drawerDark ? `white` : undefined') mdi-home
      v-list-item-title {{$t('common:header.home')}}
    template(v-for='(groupTags, groupName) in tagsGrouped')
      v-divider.my-2
      v-subheader.pl-4(:key='`tagGroup-` + groupName') {{groupName}}
      v-list-item(v-for='tag of groupTags', @click='toggleTag(tag.tag)', :key='`tag-` + tag.tag')
        v-list-item-icon
          v-icon(v-if='isSelected(tag.tag)', :color='drawerDark ? `white` : `primary`') mdi-checkbox-intermediate
          v-icon(v-else, :color='drawerDark ? `white` : undefined') mdi-checkbox-blank-outline
        v-list-item-title {{tag.title}}
</template>

<script>
import tagsQuery from 'gql/common/common-pages-query-tags.gql'

export default {
  i18nOptions: { namespaces: ['tags', 'common'] },
  data () {
    return {
      tags: [],
      selection: []
    }
  },
  computed: {
    drawerDark () {
      return this.$vuetify.breakpoint.smAndDown || this.$vuetify.theme.dark
    },
    tagsGrouped () {
      const grouped = {}
      for (const tag of this.tags) {
        const key = tag.title.charAt(0).toUpperCase()
        if (!grouped[key]) {
          grouped[key] = []
        }
        grouped[key].push(tag)
      }
      return grouped
    }
  },
  watch: {
    '$route.path' () {
      this.syncSelectionFromRoute()
    }
  },
  mounted () {
    this.syncSelectionFromRoute()
  },
  methods: {
    syncSelectionFromRoute () {
      if (!this.$route) { return }
      this.selection = decodeURI(this.$route.path).split('/').filter(Boolean)
    },
    isSelected (tag) {
      return this.selection.includes(tag)
    },
    toggleTag (tag) {
      if (this.selection.includes(tag)) {
        this.selection = this.selection.filter(t => t !== tag)
      } else {
        this.selection.push(tag)
      }
      if (this.$router) {
        this.$router.push('/' + this.selection.join('/'))
      }
      this.$emit('navigate')
    },
    onNavigate () {
      this.$emit('navigate')
    }
  },
  apollo: {
    tags: {
      query: tagsQuery,
      fetchPolicy: 'cache-and-network',
      update: (data) => JSON.parse(JSON.stringify(data.pages.tags)),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'tags-refresh')
      }
    }
  }
}
</script>
