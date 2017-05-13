'use strict'

const Mongoose = require('mongoose')

/**
 * Upload File schema
 *
 * @type       {<Mongoose.Schema>}
 */
var uplFileSchema = Mongoose.Schema({

  _id: String,

  category: {
    type: String,
    required: true,
    default: 'binary'
  },
  mime: {
    type: String,
    required: true,
    default: 'application/octet-stream'
  },
  extra: {
    type: Object
  },
  folder: {
    type: String,
    ref: 'UplFolder'
  },
  filename: {
    type: String,
    required: true
  },
  basename: {
    type: String,
    required: true
  },
  filesize: {
    type: Number,
    required: true
  }

}, { timestamps: {} })

module.exports = Mongoose.model('UplFile', uplFileSchema)
