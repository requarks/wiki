'use strict'

import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'

const rootUrl = '/'

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
                let branch = _.last(self.tree)
                branch.hasChildren = true
                _.find(branch.pages, { _id: basePath }).isActive = true
              }
              self.tree.push({
                hasChildren: false,
                pages: data
              })
              $('#notifload').removeClass('active')
            })
          })
        },
        goto: function (entryPath) {
          window.location.assign(rootUrl + entryPath)
        },
        unfold: function (entryPath) {
          let self = this
          let lastIndex = 0
          _.forEach(self.tree, branch => {
            lastIndex++
            if (_.find(branch.pages, { _id: entryPath }) !== undefined) {
              return false
            }
          })
          self.tree = _.slice(self.tree, 0, lastIndex)
          let branch = _.last(self.tree)
          branch.hasChildren = false
          branch.pages.forEach(page => {
            page.isActive = false
          })
        },
        mainAction: function (page) {
          let self = this
          if (page.isActive) {
            self.unfold(page._id)
          } else if (page.isDirectory) {
            self.fetch(page._id)
          } else {
            self.goto(page._id)
          }
        }
      },
      mounted: function () {
        let basePath = window.location.pathname.slice(0, -4)
        if (basePath.length > 1) {
          basePath = basePath.slice(1)
        }
        this.fetch(basePath)
      }
    })
  }
}
