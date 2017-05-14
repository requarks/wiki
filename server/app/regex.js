'use strict'

module.exports = {
  arabic: '\u0600-\u06ff\u0750-\u077f\ufb50-\ufc3f\ufe70-\ufefc',
  cjk: '\u4E00-\u9FBF\u3040-\u309F\u30A0-\u30FFㄱ-ㅎ가-힣ㅏ-ㅣ',
  youtube: /(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/,
  vimeo: /vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^/]*)\/videos\/|album\/(?:\d+)\/video\/|)(\d+)(?:$|\/|\?)/,
  dailymotion: /(?:dailymotion\.com(?:\/embed)?(?:\/video|\/hub)|dai\.ly)\/([0-9a-z]+)(?:[-_0-9a-zA-Z]+(?:#video=)?([a-z0-9]+)?)?/
}
