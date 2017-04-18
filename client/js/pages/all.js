'use strict'

import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'

module.exports = (alerts, socket) => {
  if ($('#page-type-all').length) {
    let vueAllPages = new Vue({ // eslint-disable-line no-unused-vars
      el: '#page-type-all',
      data: {
        tree: []
      },
      methods: {
        fetch: function (basePath) {
          let self = this
          $('#notifload').addClass('active')
          Vue.nextTick(() => {
            socket.emit('treeFetch', { basePath }, (data) => {
              if (self.tree.length > 0) {
                let curTree = _.last(self.tree)
                curTree.hasChildren = true
                _.find(curTree.pages, { _id: basePath }).isActive = true
              }
              self.tree.push({
                hasChildren: false,
                pages: data
              })
              $('#notifload').removeClass('active')
            })
          })
        }
      },
      mounted: function () {
        this.fetch('')
      }
    })
  }
}
