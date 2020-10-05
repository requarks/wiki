const { injectPageMetadata } = require('../../helpers/page')

describe('helpers/page/injectPageMetadata', () => {
  const page = {
    title: 'PAGE TITLE',
    description: 'A PAGE',
    isPublished: true,
    updatedAt: new Date(),
    content: 'TEST CONTENT',
    createdAt: new Date('2019-01-01')
  }

  it('returns the page content by default when content type is unknown', () => {
    const expected = 'TEST CONTENT'
    const result = injectPageMetadata(page)
    expect(result).toEqual(expected)
  })

  it('injects metadata for markdown contents', () => {
    const markdownPage = {
      ...page,
      contentType: 'markdown',
      editorKey: 'markdown'
    }

    const expected = `---
title: ${markdownPage.title}
description: ${markdownPage.description}
published: ${markdownPage.isPublished.toString()}
date: ${markdownPage.updatedAt}
tags:\x20
editor: ${markdownPage.editorKey}
dateCreated: ${markdownPage.createdAt}\n---

TEST CONTENT`

    const result = injectPageMetadata(markdownPage)
    expect(result).toEqual(expected)
  })

  it('injects metadata for html contents', () => {
    const htmlPage = {
      ...page,
      contentType: 'html',
      editorKey: 'html'
    }

    const expected = `<!--
title: ${htmlPage.title}
description: ${htmlPage.description}
published: ${htmlPage.isPublished.toString()}
date: ${htmlPage.updatedAt}
tags:\x20
editor: ${htmlPage.editorKey}
dateCreated: ${htmlPage.createdAt}\n-->

TEST CONTENT`

    const result = injectPageMetadata(htmlPage)
    expect(result).toEqual(expected)
  })
})
