'use strict'

import $ from 'jquery'
import _ from 'lodash'
import { setInputSelection } from '../helpers/form'
import { makeSafePath } from '../helpers/pages'

// -> Move Existing Document

module.exports = (currentBasePath, alerts) => {
  if (currentBasePath !== '') {
    $('.btn-move-prompt').removeClass('is-hidden')
  }

  let moveInitialDocument = _.lastIndexOf(currentBasePath, '/') + 1

  $('.btn-move-prompt').on('click', (ev) => {
    $('#txt-move-prompt').val(currentBasePath)
    $('#modal-move-prompt').toggleClass('is-active')
    setInputSelection($('#txt-move-prompt').get(0), moveInitialDocument, currentBasePath.length)
    $('#txt-move-prompt').removeClass('is-danger').next().addClass('is-hidden')
  })

  $('#txt-move-prompt').on('keypress', (ev) => {
    if (ev.which === 13) {
      $('.btn-move-go').trigger('click')
    }
  })

  $('.btn-move-go').on('click', (ev) => {
    let newDocPath = makeSafePath($('#txt-move-prompt').val())
    if (_.isEmpty(newDocPath) || newDocPath === currentBasePath || newDocPath === 'home') {
      $('#txt-move-prompt').addClass('is-danger').next().removeClass('is-hidden')
    } else {
      $('#txt-move-prompt').parent().addClass('is-loading')

      $.ajax(window.location.href, {
        data: {
          move: newDocPath
        },
        dataType: 'json',
        method: 'PUT'
      }).then((rData, rStatus, rXHR) => {
        if (rData.ok) {
          window.location.assign('/' + newDocPath)
        } else {
          alerts.pushError('Something went wrong', rData.error)
        }
      }, (rXHR, rStatus, err) => {
        alerts.pushError('Something went wrong', 'Save operation failed.')
      })
    }
  })
}
