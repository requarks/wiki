'use strict'

/* global alertsData */

import jQuery from 'jquery'
import _ from 'lodash'
import Sticky from 'sticky-js'
import io from 'socket.io-client'
import Alerts from './components/alerts.js'
/* eslint-disable spaced-comment */

jQuery(document).ready(function ($) {
  // ====================================
  // Scroll
  // ====================================

  $('a').smoothScroll({
    speed: 400,
    offset: -70
  })

  var sticky = new Sticky('.stickyscroll') // eslint-disable-line no-unused-vars

  // ====================================
  // Notifications
  // ====================================

  $(window).bind('beforeunload', () => {
    $('#notifload').addClass('active')
  })
  $(document).ajaxSend(() => {
    $('#notifload').addClass('active')
  }).ajaxComplete(() => {
    $('#notifload').removeClass('active')
  })

  var alerts = new Alerts()
  if (alertsData) {
    _.forEach(alertsData, (alertRow) => {
      alerts.push(alertRow)
    })
  }

  // ====================================
  // Establish WebSocket connection
  // ====================================

  var socket = io(window.location.origin) // eslint-disable-line no-unused-vars

  //=include components/search.js

  // ====================================
  // Pages logic
  // ====================================

  //=include pages/view.js
  //=include pages/create.js
  //=include pages/edit.js
  //=include pages/source.js
  //=include pages/admin.js
})

//=include helpers/form.js
//=include helpers/pages.js

//=include components/alerts.js

/* eslint-enable spaced-comment */
