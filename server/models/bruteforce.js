'use strict'

/**
 * BruteForce schema
 *
 * @type       {<Mongoose.Schema>}
 */
var bruteForceSchema = Mongoose.Schema({
  _id: { type: String, index: 1 },
  data: {
    count: Number,
    lastRequest: Date,
    firstRequest: Date
  },
  expires: { type: Date, index: { expires: '1d' } }
})

module.exports = Mongoose.model('Bruteforce', bruteForceSchema)
