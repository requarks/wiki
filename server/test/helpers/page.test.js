const pageHelper = require('../../helpers/page')
const { injectPageMetadata } = pageHelper

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

describe('helpers/page/parseRequestPath', () => {
  beforeAll(() => {
    global.WIKI = {
      config: {
        lang: { code: 'en' },
        pageExtensions: ['md', 'html', 'txt']
      }
    }
  })

  afterAll(() => {
    delete global.WIKI
  })

  it('treats a path without an extension as a page', () => {
    const result = pageHelper.parseRequestPath('/folder/page')
    expect(result.isPage).toBe(true)
    expect(result.pageArgs.path).toEqual('folder/page')
  })

  it('treats a path ending in a page extension as a page and strips it', () => {
    const result = pageHelper.parseRequestPath('/folder/page.md')
    expect(result.isPage).toBe(true)
    expect(result.pageArgs.path).toEqual('folder/page')
  })

  it('treats any other extension as an asset and keeps it', () => {
    const result = pageHelper.parseRequestPath('/folder/img/pic.png')
    expect(result.isPage).toBe(false)
    expect(result.pageArgs.path).toEqual('folder/img/pic.png')
  })

  it('treats a dot outside the last segment as an asset', () => {
    const result = pageHelper.parseRequestPath('/release/v1.2/notes')
    expect(result.isPage).toBe(false)
  })

  it('reads an asset the same way under a route prefix and locale as at the root', () => {
    const prefixed = pageHelper.parseRequestPath('/e/en/folder/img/pic.png')
    const plain = pageHelper.parseRequestPath('/folder/img/pic.png')
    expect(prefixed.isPage).toBe(plain.isPage)
    expect(prefixed.pageArgs.path).toEqual(plain.pageArgs.path)
  })
})
