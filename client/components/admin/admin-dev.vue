<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-console.svg', alt='Developer Tools', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Developer Tools
            .subheading.grey--text ¯\_(ツ)_/¯
          v-spacer
          v-card.radius-7
            v-card-text
              .caption Enables extra dev options and removes many safeguards.
              .caption.red--text Do not enable unless you know what you're doing!
              v-switch.mt-1(
                color='primary'
                hide-details
                label='Dev Mode'
              )

        v-card.mt-3.white.grey--text.text--darken-3
          v-tabs(
            v-model='selectedTab'
            color='grey darken-2'
            fixed-tabs
            slider-color='white'
            show-arrows
            dark
            @change='tabChanged'
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
      selectedTab: 0
    }
  },
  mounted() {
    this.renderGraphiQL()
  },
  methods: {
    tabChanged (tabId) {
      switch (tabId) {
        case 1:
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

#voyager {
  height: calc(100vh - 270px);

  .title-area {
    display: none;
  }
  .type-doc {
    margin-top: 5px;
  }

  .doc-navigation {
    > span {
      overflow-y: hidden;
      display: block;
    }
    min-height: 40px;
  }

  .contents {
    padding-bottom: 0;
    color: #666;
  }

  .type-info-popover {
    display: none;
  }
}
</style>
