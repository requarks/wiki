<template lang='pug'>
  div
    v-card(flat, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"').pa-3.pt-4
      .admin-header-icon: v-icon(size='80', color='grey lighten-2') weekend
      .headline.primary--text Developer Tools
      .subheading.grey--text ¯\_(ツ)_/¯
    v-tabs(
      v-model='selectedTab'
      :color='$vuetify.dark ? "primary" : "grey lighten-4"'
      fixed-tabs
      :slider-color='$vuetify.dark ? "white" : "primary"'
      show-arrows
      @input='tabChanged'
      )
      v-tab(key='0') Graph API Playground
      v-tab(key='1') Graph API Map
    v-tabs-items(v-model='selectedTab')
      v-tab-item(key='0', :transition='false', :reverse-transition='false')
        #graphiql

      v-tab-item(key='1', :transition='false', :reverse-transition='false')
        #voyager

</template>

<script>
import _ from 'lodash'
import React from 'react'
import ReactDOM from 'react-dom'
import GraphiQL from 'graphiql'
import { Voyager } from 'graphql-voyager'
import 'graphiql/graphiql.css'
import 'graphql-voyager/dist/voyager.css'

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

let graphiQLInstance

export default {
  data() {
    return {
      selectedTab: '0'
    }
  },
  mounted() {
    this.renderGraphiQL()
  },
  methods: {
    tabChanged (tabId) {
      switch (tabId) {
        case '1':
          this.renderVoyager()
          break
      }
    },
    renderGraphiQL() {
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
          query: '',
          response: null,
          variables: null,
          operationName: null,
          websocketConnectionParams: null
        }),
        document.getElementById('graphiql')
      )
      graphiQLInstance.queryEditorComponent.editor.refresh()
      graphiQLInstance.variableEditorComponent.editor.refresh()
      graphiQLInstance.state.variableEditorOpen = true
    },
    renderVoyager() {
      ReactDOM.render(
        React.createElement(Voyager, {
          introspection: qry => fetcher({ query: qry }, 'json'),
          workerURI: '/js/voyager.worker.js'
        }),
        document.getElementById('voyager')
      )
    }
  }
}
</script>

<style lang='scss'>

#graphiql {
  height: calc(100vh - 230px);

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
}

#voyager {
  height: calc(100vh - 250px);

  .title-area {
    display: none;
  }
  .type-doc {
    margin-top: 5px;
  }
}
</style>
