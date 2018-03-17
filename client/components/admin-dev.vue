<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Developer Tools
        .subheading.grey--text ¯\_(ツ)_/¯
      v-tabs(color='grey lighten-4', fixed-tabs, slider-color='primary', show-arrows)
        v-tab Graph API Playground
        v-tab Graph API Map

        v-tab-item(:transition='false', :reverse-transition='false')
          #graphiql
</template>

<script>
import React from 'react'
import ReactDOM from 'react-dom'
import GraphiQL from 'graphiql'

export default {
  data() {
    return {}
  },
  mounted() {
    this.renderGraphiQL()
  },
  methods: {
    renderGraphiQL() {
      ReactDOM.render(
        React.createElement(GraphiQL, {
          fetcher: graphQLParams => {
            return fetch('/graphql', {
              method: 'post',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(graphQLParams),
              credentials: 'include'
            }).then(function (response) {
              return response.text()
            }).then(function (responseBody) {
              try {
                return JSON.parse(responseBody)
              } catch (error) {
                return responseBody
              }
            })
          },
          query: null,
          response: null,
          variables: null,
          operationName: null,
          websocketConnectionParams: null
        }),
        document.getElementById('graphiql')
      )
    }
  }
}
</script>

<style lang='scss'>

#graphiql {
  height: calc(100vh - 250px);

  .topBar {
    background-color: mc('grey', '200');
    background-image: none;
    padding: 1.5rem 0;

    > .title {
      display: none;
    }
  }

  .toolbar {
    background-color: initial;
    box-shadow: initial;
  }

  .cm-s-wikijs-dark.CodeMirror {
    background: darken(mc('grey','900'), 3%);
    color: #e0e0e0;
  }
  .cm-s-wikijs-dark div.CodeMirror-selected {
    background: mc('blue','800');
  }
  .cm-s-wikijs-dark .cm-matchhighlight {
    background: mc('blue','800');
  }
  .cm-s-wikijs-dark .CodeMirror-line::selection, .cm-s-wikijs-dark .CodeMirror-line > span::selection, .cm-s-wikijs-dark .CodeMirror-line > span > span::selection {
    background: mc('red', '500');
  }
  .cm-s-wikijs-dark .CodeMirror-line::-moz-selection, .cm-s-wikijs-dark .CodeMirror-line > span::-moz-selection, .cm-s-wikijs-dark .CodeMirror-line > span > span::-moz-selection {
    background: mc('red', '500');
  }
  .cm-s-wikijs-dark .CodeMirror-gutters {
    background: darken(mc('grey','900'), 6%);
    border-right: 1px solid mc('grey','900');
  }
  .cm-s-wikijs-dark .CodeMirror-guttermarker {
    color: #ac4142;
  }
  .cm-s-wikijs-dark .CodeMirror-guttermarker-subtle {
    color: #505050;
  }
  .cm-s-wikijs-dark .CodeMirror-linenumber {
    color: mc('grey','800');
  }
  .cm-s-wikijs-dark .CodeMirror-cursor {
    border-left: 1px solid #b0b0b0;
  }
  .cm-s-wikijs-dark span.cm-comment {
    color: mc('orange','800');
  }
  .cm-s-wikijs-dark span.cm-atom {
    color: #aa759f;
  }
  .cm-s-wikijs-dark span.cm-number {
    color: #aa759f;
  }
  .cm-s-wikijs-dark span.cm-property, .cm-s-wikijs-dark span.cm-attribute {
    color: #90a959;
  }
  .cm-s-wikijs-dark span.cm-keyword {
    color: #ac4142;
  }
  .cm-s-wikijs-dark span.cm-string {
    color: #f4bf75;
  }
  .cm-s-wikijs-dark span.cm-variable {
    color: #90a959;
  }
  .cm-s-wikijs-dark span.cm-variable-2 {
    color: #6a9fb5;
  }
  .cm-s-wikijs-dark span.cm-def {
    color: #d28445;
  }
  .cm-s-wikijs-dark span.cm-bracket {
    color: #e0e0e0;
  }
  .cm-s-wikijs-dark span.cm-tag {
    color: #ac4142;
  }
  .cm-s-wikijs-dark span.cm-link {
    color: #aa759f;
  }
  .cm-s-wikijs-dark span.cm-error {
    background: #ac4142;
    color: #b0b0b0;
  }
  .cm-s-wikijs-dark .CodeMirror-activeline-background {
    background: mc('grey','900');
  }
  .cm-s-wikijs-dark .CodeMirror-matchingbracket {
    text-decoration: underline;
    color: white !important;
  }
}
</style>
