'use strict'

const Mongoose = require('mongoose')

/**
 * Entry schema
 *
 * @type       {<Mongoose.Schema>}
 */
var entrySchema = Mongoose.Schema({
  _id: String,

  title: {
    type: String,
    required: true,
    minlength: 2
  },
  subtitle: {
    type: String,
    default: ''
  },
  parentTitle: {
    type: String,
    default: ''
  },
  parentPath: {
    type: String,
    default: ''
  },
  isDirectory: {
    type: Boolean,
    default: false
  },
  isEntry: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {}
})

module.exports = Mongoose.model('Entry', entrySchema)
