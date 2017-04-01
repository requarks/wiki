'use strict'

import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'

const videoRules = {
  'youtube': new RegExp(/(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/, 'i'),
  'vimeo': new RegExp(/vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|)(\d+)(?:$|\/|\?)/, 'i'),
  'dailymotion': new RegExp(/(?:dailymotion\.com(?:\/embed)?(?:\/video|\/hub)|dai\.ly)\/([0-9a-z]+)(?:[-_0-9a-zA-Z]+(?:#video=)?([a-z0-9]+)?)?/, 'i')
}

module.exports = (mde, mdeModalOpenState) => {
  // Vue Video instance

  let vueVideo = new Vue({
    el: '#modal-editor-video',
    data: {
      link: ''
    },
    methods: {
      open: (ev) => {
        $('#modal-editor-video').addClass('is-active')
        $('#modal-editor-video input').focus()
      },
      cancel: (ev) => {
        mdeModalOpenState = false // eslint-disable-line no-undef
        $('#modal-editor-video').removeClass('is-active')
        vueVideo.link = ''
      },
      insertVideo: (ev) => {
        if (mde.codemirror.doc.somethingSelected()) {
          mde.codemirror.execCommand('singleSelection')
        }

        // Guess video type

        let videoType = _.findKey(videoRules, (vr) => {
          return vr.test(vueVideo.link)
        })
        if (_.isNil(videoType)) {
          videoType = 'video'
        }

        // Insert video tag

        let videoText = '[video](' + vueVideo.link + '){.' + videoType + '}\n'

        mde.codemirror.doc.replaceSelection(videoText)
        vueVideo.cancel()
      }
    }
  })
  return vueVideo
}
