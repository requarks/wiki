<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-console.svg', alt='Developer Tools', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Developer Tools
            .subtitle-1.grey--text Voyager

        v-card.mt-3.white.grey--text.text--darken-3
          #voyager

</template>

<script>
import _ from 'lodash'
import React from 'react'
import ReactDOM from 'react-dom'
import { Voyager } from 'graphql-voyager'
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
    return {}
  },
  mounted() {
    _.delay(() => {
      ReactDOM.render(
        React.createElement(Voyager, {
          introspection: qry => fetcher({ query: qry }, 'json'),
          workerURI: '/js/voyager.worker.js'
        }),
        document.getElementById('voyager')
      )
    }, 500)
  }
}
</script>

<style lang='scss'>
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
