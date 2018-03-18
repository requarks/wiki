<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Developer Tools
        .subheading.grey--text ¯\_(ツ)_/¯
      v-tabs(v-model='selectedTab', color='grey lighten-4', fixed-tabs, slider-color='primary', show-arrows, @input='tabChanged')
        v-tab(key='0') Graph API Playground
        v-tab(key='1') Graph API Map
      v-tabs-items(v-model='selectedTab')
        v-tab-item(key='0', :transition='false', :reverse-transition='false')
          #graphiql

        v-tab-item(key='1', :transition='false', :reverse-transition='false')
          #voyager

</template>

<script>
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
          fetcher: qry => fetcher(qry, 'text'),
          query: null,
          response: null,
          variables: null,
          operationName: null,
          websocketConnectionParams: null
        }),
        document.getElementById('graphiql')
      )
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
}

#voyager {
  height: calc(100vh - 250px);
}
</style>
