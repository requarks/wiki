<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-console.svg', alt='Developer Tools', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Developer Tools
            .subheading.grey--text GraphiQL

        v-card.mt-3.white.grey--text.text--darken-3
          #graphiql

</template>

<script>
import _ from 'lodash'
import React from 'react'
import ReactDOM from 'react-dom'
import GraphiQL from 'graphiql'
import 'graphiql/graphiql.css'

const fetcher = (qry, respType) => {
  return fetch('/graphql', {
    method: 'post',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(qry),
    credentials: 'include'
  }).then(response => {
    if (respType === 'json') {
      return response.json()
    } else {
      return response.text()
    }
  }).then(responseBody => {
    try {
      return JSON.parse(responseBody)
    } catch (error) {
      return responseBody
    }
  })
}

export default {
  data() {
    return { }
  },
  mounted() {
    let graphiQLInstance
    ReactDOM.render(
      React.createElement(GraphiQL, {
        ref(el) { graphiQLInstance = el },
        async fetcher(qry) {
          let resp = await fetcher(qry, 'text')
          _.delay(() => {
            graphiQLInstance.resultComponent.viewer.refresh()
          }, 500)
          return resp
        },
        response: null,
        variables: '{}',
        operationName: null,
        websocketConnectionParams: null
      }),
      document.getElementById('graphiql')
    )
    graphiQLInstance.queryEditorComponent.editor.refresh()
    graphiQLInstance.variableEditorComponent.editor.refresh()
    graphiQLInstance.state.variableEditorOpen = true
    graphiQLInstance.state.docExplorerOpen = true
  }
}
</script>

<style lang='scss'>
#graphiql {
  height: calc(100vh - 270px);

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

  .doc-explorer-title-bar, .history-title-bar {
    height: auto;
  }
}
</style>
