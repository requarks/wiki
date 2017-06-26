'use strict'

const Mongoose = require('mongoose')

/**
 * Settings schema
 *
 * @type       {<Mongoose.Schema>}
 */
var settingSchema = Mongoose.Schema({
  key: {
    type: String,
    required: true,
    index: true
  },
  value: {
    type: String,
    required: true
  }
}, { timestamps: {} })

module.exports = Mongoose.model('Setting', settingSchema)
