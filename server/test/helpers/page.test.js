const { injectPageMetadata } = require('../../helpers/page')

describe('injectPageMetadata tests', () => {
  let page = {
    title: 'PAGE TITLE',
    description: 'A PAGE',
    isPublished: true,
    updatedAt: new Date(),
    content: 'TEST CONTENT'
  }
  test('injectPageMetadata: default', () => {
    const expected = 'TEST CONTENT'
    const result = injectPageMetadata(page)
    expect(result).toEqual(expected)
  })
  test('injectPageMetadata: markdown', () => {
    page.contentType = 'markdown'
    const expected = `---
title: ${page.title}
description: ${page.description}
published: ${page.isPublished.toString()}
date: ${page.updatedAt}
tags: \n---

TEST CONTENT`
    const result = injectPageMetadata(page)
    expect(result).toEqual(expected)
  })

  test('injectPageMetadata: hmtl', () => {
    page.contentType = 'html'
    const expected = `<!--
title: ${page.title}
description: ${page.description}
published: ${page.isPublished.toString()}
date: ${page.updatedAt}
tags: \n-->

TEST CONTENT`
    const result = injectPageMetadata(page)
    expect(result).toEqual(expected)
  })
})
