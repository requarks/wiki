<template lang="pug">
  .nav-item
    p.control(v-bind:class='{ "is-loading": searchload > 0 }')
      input.input#search-input(type='text', v-model='searchq', autofocus, @keyup.esc='closeSearch', @keyup.down='moveDownSearch', @keyup.up='moveUpSearch', @keyup.enter='moveSelectSearch', debounce='400', v-bind:placeholder='$t("search.placeholder")')

    transition(name='searchresults')
      .searchresults(v-show='searchactive', v-cloak)
        p.searchresults-label {{ $t('search.results') }}
        ul.searchresults-list
          li(v-if='searchres.length === 0')
            a: em {{ $t('search.nomatch') }}
          li(v-for='sres in searchres', v-bind:class='{ "is-active": searchmovekey === "res." + sres.entryPath }')
            a(v-bind:href='siteRoot + "/" + sres.entryPath') {{ sres.title }}
        p.searchresults-label(v-if='searchsuggest.length > 0') {{ $t('search.didyoumean') }}
        ul.searchresults-list(v-if='searchsuggest.length > 0')
          li(v-for='sug in searchsuggest', v-bind:class='{ "is-active": searchmovekey === "sug." + sug }')
            a(v-on:click='useSuggestion(sug)') {{ sug }}
</template>

<script>
export default {
  data() {
    return {
      searchq: '',
      searchres: [],
      searchsuggest: [],
      searchload: 0,
      searchactive: false,
      searchmoveidx: 0,
      searchmovekey: '',
      searchmovearr: []
    }
  },
  watch: {
    searchq: function (val, oldVal) {
      let self = this
      self.searchmoveidx = 0
      if (val.length >= 3) {
        self.searchactive = true
        self.searchload++
        socket.emit('search', { terms: val }, (data) => {
          self.searchres = data.match
          self.searchsuggest = data.suggest
          self.searchmovearr = self._.concat([], self.searchres, self.searchsuggest)
          if (self.searchload > 0) { self.searchload-- }
        })
      } else {
        self.searchactive = false
        self.searchres = []
        self.searchsuggest = []
        self.searchmovearr = []
        self.searchload = 0
      }
    },
    searchmoveidx: function (val, oldVal) {
      if (val > 0) {
        this.searchmovekey = (this.searchmovearr[val - 1])
          ? 'res.' + this.searchmovearr[val - 1].entryPath
          : 'sug.' + this.searchmovearr[val - 1]
      } else {
        this.searchmovekey = ''
      }
    }
  },
  methods: {
    useSuggestion: function (sug) {
      this.searchq = sug
    },
    closeSearch: function () {
      this.searchq = ''
    },
    moveSelectSearch: function () {
      if (this.searchmoveidx < 1) { return }
      let i = this.searchmoveidx - 1

      if (this.searchmovearr[i]) {
        window.location.assign(siteRoot + '/' + this.searchmovearr[i].entryPath)
      } else {
        this.searchq = this.searchmovearr[i]
      }
    },
    moveDownSearch: function () {
      if (this.searchmoveidx < this.searchmovearr.length) {
        this.searchmoveidx++
      }
    },
    moveUpSearch: function () {
      if (this.searchmoveidx > 0) {
        this.searchmoveidx--
      }
    }
  },
  mounted: function () {
    let self = this
    $('main').on('click', self.closeSearch)
  }
}
</script>
