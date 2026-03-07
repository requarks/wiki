<template lang="pug">
  .search-results(v-if='searchIsFocused || (search && search.length > 1)')
    .search-results-container
      .search-results-help(v-if='!search || (search && search.length < 2)')
        img(src='/_assets/svg/icon-search-alt.svg')
        .mt-4 {{$t('common:header.searchHint')}}
      .search-results-loader(v-else-if='searchIsLoading && (!results || results.length < 1)')
        orbit-spinner(
          :animation-duration='1000'
          :size='100'
          color='#FFF'
        )
        .headline.mt-5 {{$t('common:header.searchLoading')}}
      .search-results-none(v-else-if='!searchIsLoading && (!results || results.length < 1)')
        img(src='/_assets/svg/icon-no-results.svg', alt='No Results')
        .subheading {{$t('common:header.searchNoResult')}}
      template(v-if='search && search.length >= 2 && results && results.length > 0')
        v-subheader.white--text {{$t('common:header.searchResultsCount', { total: response.totalHits })}}
        v-list.search-results-items.radius-7.py-0(three-line, dense)
          template(v-for='(item, idx) of results')
            v-list-item(@click='goToPage(item)', @click.middle="goToPageInNewTab(item)", :key='item.id', :class='idx === cursor ? `highlighted` : ``')
              v-list-item-avatar(tile)
                img(src='/_assets/svg/icon-selective-highlighting.svg')
              v-list-item-content
                v-list-item-title.search-results-title(v-html='highlightMatch(item.title)')
                .search-results-snippet(v-html='formatSnippet(item.snippet || buildSnippet(item))')
                .caption.grey--text.search-results-path(v-html='highlightMatch(item.path)')
              v-list-item-action
                v-chip(label, outlined) {{item.locale.toUpperCase()}}
            v-divider(v-if='idx < results.length - 1')
        v-pagination.mt-3(
          v-if='paginationLength > 1'
          dark
          v-model='pagination'
          :length='paginationLength'
          circle
        )
      template(v-if='suggestions && suggestions.length > 0')
        v-subheader.white--text.mt-3 {{$t('common:header.searchDidYouMean')}}
        v-list.search-results-suggestions.radius-7(dense, dark)
          template(v-for='(term, idx) of suggestions')
            v-list-item(:key='term', @click='setSearchTerm(term)', :class='idx + results.length === cursor ? `highlighted` : ``')
              v-list-item-avatar
                v-icon mdi-magnify
              v-list-item-content
                v-list-item-title(v-text='term')
            v-divider(v-if='idx < suggestions.length - 1')
      .text-xs-center.pt-5(v-if='search && search.length > 1')
        //- v-btn.mx-2(outlined, color='orange', @click='search = ``', v-if='results.length > 0')
        //-   v-icon(left) mdi-content-save
        //-   span {{$t('common:header.searchCopyLink')}}
        v-btn.mx-2(outlined, color='pink', @click='search = ``')
          v-icon(left) mdi-close
          span {{$t('common:header.searchClose')}}
</template>

<script>
import _ from 'lodash'
import { sync } from 'vuex-pathify'
import { OrbitSpinner } from 'epic-spinners'

import searchPagesQuery from 'gql/common/common-pages-query-search.gql'

export default {
  components: {
    OrbitSpinner
  },
  data() {
    return {
      cursor: 0,
      pagination: 1,
      perPage: 10,
      response: {
        results: [],
        suggestions: [],
        totalHits: 0
      }
    }
  },
  computed: {
    search: sync('site/search'),
    searchIsFocused: sync('site/searchIsFocused'),
    searchIsLoading: sync('site/searchIsLoading'),
    searchRestrictLocale: sync('site/searchRestrictLocale'),
    searchRestrictPath: sync('site/searchRestrictPath'),
    searchTerms() {
      if (!this.search) {
        return []
      }

      const terms = this.search.split(/\s+/).reduce((acc, term) => {
        acc.push(term, term.replace(/^[*+"'():|&!<>\-]+|[*+"'():|&!<>\-]+$/g, ''))
        return acc
      }, [])

      return _.sortBy(_.uniq(terms
        .map(term => _.trim(term))
        .filter(term => term.length > 1)
      ), term => -term.length)
    },
    results() {
      return this.response.results ? this.response.results : []
    },
    hits() {
      return this.response.totalHits ? this.response.totalHits : 0
    },
    suggestions() {
      return this.response.suggestions ? this.response.suggestions : []
    },
    paginationLength() {
      return (this.response.totalHits > 0) ? Math.ceil(this.response.totalHits / this.perPage) : 0
    }
  },
  watch: {
    search(newValue, oldValue) {
      this.cursor = 0
      this.pagination = 1
      if (!newValue || (newValue && newValue.length < 2)) {
        this.searchIsLoading = false
      } else {
        this.searchIsLoading = true
      }
    },
    results() {
      this.cursor = 0
    }
  },
  mounted() {
    this.$root.$on('searchMove', (dir) => {
      this.cursor += ((dir === 'up') ? -1 : 1)
      if (this.cursor < -1) {
        this.cursor = -1
      } else if (this.cursor > this.results.length + this.suggestions.length - 1) {
        this.cursor = this.results.length + this.suggestions.length - 1
      }
    })
    this.$root.$on('searchEnter', () => {
      if (!this.results) {
        return
      }

      if (this.cursor >= 0 && this.cursor < this.results.length) {
        this.goToPage(_.nth(this.results, this.cursor))
      } else if (this.cursor >= 0) {
        this.setSearchTerm(_.nth(this.suggestions, this.cursor - this.results.length))
      }
    })
  },
  methods: {
    escapeHtml(value = '') {
      return _.escape(value)
    },
    findFirstMatchIndex(value = '') {
      const text = _.toString(value)
      const normalizedText = text.toLowerCase()

      for (const term of this.searchTerms) {
        const idx = normalizedText.indexOf(term.toLowerCase())
        if (idx >= 0) {
          return idx
        }
      }

      return -1
    },
    highlightMatch(value = '') {
      const escapedValue = this.escapeHtml(value)

      if (_.isEmpty(this.searchTerms)) {
        return escapedValue
      }

      const pattern = this.searchTerms.map(term => _.escapeRegExp(term)).join('|')
      if (!pattern) {
        return escapedValue
      }

      return escapedValue.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>')
    },
    formatSnippet(value = '') {
      const highlightedValue = this.highlightMatch(value)

      return highlightedValue.replace(/^(\.{3})?([^:|]{2,72}:)(\s+)/, (match, prefix = '', heading, spacing) => {
        return `${prefix}<strong>${heading}</strong>${spacing}`
      })
    },
    buildSnippet(item) {
      const source = _.trim(item.description || item.title || item.path || '')

      if (!source) {
        return ''
      }

      const snippetLength = 120
      const matchIndex = this.findFirstMatchIndex(source)
      let start = 0

      if (matchIndex >= 0) {
        start = Math.max(0, matchIndex - 36)
      }

      let snippet = source.slice(start, start + snippetLength).trim()

      if (start > 0) {
        snippet = `...${snippet}`
      }
      if (start + snippetLength < source.length) {
        snippet = `${snippet}...`
      }

      return snippet
    },
    setSearchTerm(term) {
      this.search = term
    },
    goToPage(item) {
      window.location.assign(`/${item.locale}/${item.path}${item.anchor || ''}`)
    },
    goToPageInNewTab(item) {
      window.open(`/${item.locale}/${item.path}${item.anchor || ''}`, '_blank')
    }
  },
  apollo: {
    response: {
      query: searchPagesQuery,
      variables() {
        return {
          query: this.search,
          page: this.pagination,
          limit: this.perPage
        }
      },
      fetchPolicy: 'network-only',
      debounce: 300,
      throttle: 1000,
      skip() {
        return !this.search || this.search.length < 2
      },
      update: (data) => _.get(data, 'pages.search', {}),
      watchLoading (isLoading) {
        this.searchIsLoading = isLoading
      }
    }
  }
}
</script>

<style lang="scss">
.search-results {
  position: fixed;
  top: 64px;
  left: 0;
  overflow-y: auto;
  width: 100%;
  height: calc(100% - 64px);
  background-color: rgba(0,0,0,.9);
  z-index: 100;
  text-align: center;
  animation: searchResultsReveal .6s ease;

  @media #{map-get($display-breakpoints, 'sm-and-down')} {
    top: 112px;
  }

  &-container {
    margin: 12px auto;
    width: 90vw;
    max-width: 1024px;
  }

  &-help {
    text-align: center;
    padding: 32px 0;
    font-size: 18px;
    font-weight: 300;
    color: #FFF;

    img {
      width: 104px;
    }
  }

  &-loader {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    padding: 32px 0;
    color: #FFF;
  }

  &-none {
    color: #FFF;

    img {
      width: 200px;
    }
  }

  &-items {
    text-align: left;

    .v-list-item {
      align-items: flex-start;
    }

    .v-list-item__content {
      overflow: hidden;
      padding-top: 4px;
      padding-bottom: 4px;
    }

    .highlighted {
      background: #FFF linear-gradient(to bottom, #FFF, mc('orange', '100'));

      @at-root .theme--dark & {
        background: mc('grey', '900') linear-gradient(to bottom, mc('orange', '900'), darken(mc('orange', '900'), 15%));
      }
    }
  }

  &-title {
    margin-bottom: 2px;
  }

  &-snippet {
    display: block;
    font-size: .8rem;
    white-space: normal;
    line-height: 1.05rem;
    overflow-wrap: anywhere;
    color: rgba(0, 0, 0, .72);
    margin-bottom: 2px;
  }

  &-path {
    display: block;
    overflow-wrap: anywhere;
  }

  mark {
    background-color: #ffd54f;
    color: inherit;
    border-radius: 3px;
    padding: 0 2px;
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, .08);
  }

  .theme--dark & mark {
    background-color: #ef6c00;
    color: #fff;
  }

  .theme--dark &-snippet {
    color: rgba(255, 255, 255, .72);
  }

  &-suggestions {
    .highlighted {
      background: transparent linear-gradient(to bottom, mc('blue', '500'), mc('blue', '700'));
    }
  }
}

@keyframes searchResultsReveal {
  0% {
    background-color: rgba(0,0,0,0);
    padding-top: 32px;
  }
  100% {
    background-color: rgba(0,0,0,.9);
    padding-top: 0;
  }
}
</style>
