import { defaultTo, isFinite } from 'lodash-es'

export function generateSuccess (msg) {
  return {
    succeeded: true,
    errorCode: 0,
    slug: 'ok',
    message: defaultTo(msg, 'Operation succeeded.')
  }
}

export function generateError (err, complete = true) {
  const error = {
    succeeded: false,
    errorCode: isFinite(err.code) ? err.code : 1,
    slug: err.name,
    message: err.message || 'An unexpected error occured.'
  }
  return (complete) ? { operation: error } : error
}
