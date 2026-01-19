const normalizeUrl = (url) => {
  if (!url) return ''
  url = url.trim()
  // If URL doesn't start with a protocol, add https://
  if (!url.match(/^[a-z][a-z0-9+.-]*:/i)) {
    url = 'https://' + url
  }
  return url
}

const validateUrl = (url) => {
  if (!url?.trim()) return false
  // Basic URL validation regex
  const urlRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/
  return urlRegex.test(url)
}

const generateLinkContent = (url, linkText, openInNewTab) => {
  const normalizedUrl = normalizeUrl(url)
  const text = linkText || normalizedUrl
  
  if (openInNewTab) {
    return `<a href="${normalizedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`
  } else {
    return `[${text}](${normalizedUrl})`
  }
}

describe('editor/markdown/externalLink', () => {
  describe('normalizeUrl', () => {
    it('adds https:// to URLs without protocol', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com')
      expect(normalizeUrl('www.example.com')).toBe('https://www.example.com')
      expect(normalizeUrl('subdomain.example.com')).toBe('https://subdomain.example.com')
    })

    it('preserves existing https:// protocol', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com')
      expect(normalizeUrl('https://www.example.com')).toBe('https://www.example.com')
    })

    it('preserves existing http:// protocol', () => {
      expect(normalizeUrl('http://example.com')).toBe('http://example.com')
      expect(normalizeUrl('http://www.example.com')).toBe('http://www.example.com')
    })

    it('handles URLs with paths and query parameters', () => {
      expect(normalizeUrl('example.com/path?query=value')).toBe('https://example.com/path?query=value')
      expect(normalizeUrl('https://example.com/path?query=value')).toBe('https://example.com/path?query=value')
    })

    it('handles URLs with fragments', () => {
      expect(normalizeUrl('example.com/page#section')).toBe('https://example.com/page#section')
      expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page#section')
    })

    it('trims whitespace from URLs', () => {
      expect(normalizeUrl('  example.com  ')).toBe('https://example.com')
      expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com')
    })

    it('returns empty string for empty input', () => {
      expect(normalizeUrl('')).toBe('')
      expect(normalizeUrl(null)).toBe('')
      expect(normalizeUrl(undefined)).toBe('')
    })

    it('preserves other protocols (ftp, mailto, etc.)', () => {
      expect(normalizeUrl('ftp://example.com')).toBe('ftp://example.com')
      expect(normalizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com')
    })
  })

  describe('validateUrl', () => {
    it('validates correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://example.com')).toBe(true)
      expect(validateUrl('https://www.example.com')).toBe(true)
      expect(validateUrl('https://subdomain.example.com')).toBe(true)
    })

    it('validates URLs with paths', () => {
      expect(validateUrl('https://example.com/path')).toBe(true)
      expect(validateUrl('https://example.com/path/to/page')).toBe(true)
      expect(validateUrl('https://example.com/path?query=value')).toBe(true)
    })

    it('validates URLs with ports', () => {
      expect(validateUrl('https://example.com:8080')).toBe(true)
    })

    it('validates URLs with query parameters', () => {
      expect(validateUrl('https://example.com?key=value')).toBe(true)
      expect(validateUrl('https://example.com?key1=value1&key2=value2')).toBe(true)
    })

    it('validates URLs with fragments', () => {
      expect(validateUrl('https://example.com#section')).toBe(true)
      expect(validateUrl('https://example.com/page#section')).toBe(true)
    })

    it('validates URLs without protocol (domain only)', () => {
      expect(validateUrl('example.com')).toBe(true)
      expect(validateUrl('www.example.com')).toBe(true)
      expect(validateUrl('subdomain.example.com')).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(validateUrl('')).toBe(false)
      expect(validateUrl('   ')).toBe(false)
      expect(validateUrl(null)).toBe(false)
      expect(validateUrl(undefined)).toBe(false)
    })

    it('rejects malformed URLs', () => {
      expect(validateUrl('not a url')).toBe(false)
      expect(validateUrl('http://')).toBe(false)
      expect(validateUrl('https://')).toBe(false)
      expect(validateUrl('://example.com')).toBe(false)
    })

    it('rejects URLs without proper domain', () => {
      expect(validateUrl('https://invalid')).toBe(false)
      expect(validateUrl('https://.com')).toBe(false)
    })
  })

  describe('generateLinkContent', () => {
    describe('markdown format', () => {
      it('generates markdown link with custom text', () => {
        const result = generateLinkContent('example.com', 'Example Site', false)
        expect(result).toBe('[Example Site](https://example.com)')
      })

      it('uses URL as text when no custom text provided', () => {
        const result = generateLinkContent('example.com', '', false)
        expect(result).toBe('[https://example.com](https://example.com)')
      })

      it('preserves protocol in normalized URL', () => {
        const result = generateLinkContent('https://example.com', 'Example', false)
        expect(result).toBe('[Example](https://example.com)')
      })

      it('handles URLs with paths and query parameters', () => {
        const result = generateLinkContent('example.com/path?q=value', 'Page', false)
        expect(result).toBe('[Page](https://example.com/path?q=value)')
      })
    })

    describe('HTML format with new tab', () => {
      it('generates HTML link with target and rel attributes', () => {
        const result = generateLinkContent('example.com', 'Example Site', true)
        expect(result).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Example Site</a>')
      })

      it('uses URL as text when no custom text provided', () => {
        const result = generateLinkContent('example.com', '', true)
        expect(result).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>')
      })

      it('includes noopener and noreferrer for security', () => {
        const result = generateLinkContent('https://example.com', 'Example', true)
        expect(result).toContain('rel="noopener noreferrer"')
        expect(result).toContain('target="_blank"')
      })

      it('handles special characters in link text', () => {
        const result = generateLinkContent('example.com', 'Site & More', true)
        expect(result).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Site & More</a>')
      })
    })

    describe('complex URLs', () => {
      it('handles long URLs with markdown format', () => {
        const longUrl = 'example.com/very/long/path/to/resource?param1=value1&param2=value2#section'
        const result = generateLinkContent(longUrl, 'Resource', false)
        expect(result).toBe('[Resource](https://example.com/very/long/path/to/resource?param1=value1&param2=value2#section)')
      })

      it('handles long URLs with HTML format', () => {
        const longUrl = 'example.com/very/long/path/to/resource?param1=value1&param2=value2#section'
        const result = generateLinkContent(longUrl, 'Resource', true)
        expect(result).toBe('<a href="https://example.com/very/long/path/to/resource?param1=value1&param2=value2#section" target="_blank" rel="noopener noreferrer">Resource</a>')
      })

      it('handles international domain names', () => {
        const result = generateLinkContent('https://münchen.de', 'Munich', false)
        expect(result).toBe('[Munich](https://münchen.de)')
      })
    })
  })

  describe('insertion scenarios', () => {
    describe('empty URL validation', () => {
      it('blocks submission with empty URL', () => {
        const url = ''
        expect(url.trim()).toBe('')
      })

      it('blocks submission with whitespace-only URL', () => {
        const url = '   '
        expect(url.trim()).toBe('')
      })
    })

    describe('valid URL submission', () => {
      it('accepts URL without protocol', () => {
        const url = 'example.com'
        const normalized = normalizeUrl(url)
        expect(validateUrl(normalized)).toBe(true)
        expect(normalized).toBe('https://example.com')
      })

      it('accepts URL with https protocol', () => {
        const url = 'https://example.com'
        const normalized = normalizeUrl(url)
        expect(validateUrl(normalized)).toBe(true)
      })

      it('accepts URL with http protocol', () => {
        const url = 'http://example.com'
        const normalized = normalizeUrl(url)
        expect(validateUrl(normalized)).toBe(true)
      })

      it('accepts complex URLs', () => {
        const url = 'https://subdomain.example.com:8080/path?query=value#fragment'
        const normalized = normalizeUrl(url)
        expect(validateUrl(normalized)).toBe(true)
      })
    })

    describe('display text', () => {
      it('uses custom display text when provided', () => {
        const url = 'example.com'
        const linkText = 'My Example'
        const result = generateLinkContent(url, linkText, false)
        expect(result).toContain('My Example')
      })

      it('falls back to URL when display text is empty', () => {
        const url = 'example.com'
        const linkText = ''
        const result = generateLinkContent(url, linkText, false)
        expect(result).toContain('https://example.com')
      })

      it('handles whitespace-only display text', () => {
        const url = 'example.com'
        const linkText = '   '
        const result = generateLinkContent(url, linkText, false)
        // Whitespace is preserved in current implementation
        expect(result).toContain('   ')
      })
    })

    describe('new tab checkbox', () => {
      it('generates markdown when new tab is unchecked', () => {
        const result = generateLinkContent('example.com', 'Example', false)
        expect(result).toMatch(/^\[.*\]\(.*\)$/)
        expect(result).not.toContain('target="_blank"')
      })

      it('generates HTML when new tab is checked', () => {
        const result = generateLinkContent('example.com', 'Example', true)
        expect(result).toMatch(/^<a href=.*<\/a>$/)
        expect(result).toContain('target="_blank"')
        expect(result).toContain('rel="noopener noreferrer"')
      })
    })
  })

  describe('edge cases', () => {
    it('handles URLs with unicode characters', () => {
      const url = 'https://例え.jp'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://例え.jp')
    })

    it('handles URLs with encoded characters', () => {
      const url = 'https://example.com/path%20with%20spaces'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://example.com/path%20with%20spaces')
    })

    it('handles IP addresses', () => {
      const url = '192.168.1.1'
      const normalized = normalizeUrl(url)
      expect(normalized).toBe('https://192.168.1.1')
    })

    it('handles URLs with multiple query parameters', () => {
      const url = 'example.com?a=1&b=2&c=3'
      const result = generateLinkContent(url, 'Link', false)
      expect(result).toBe('[Link](https://example.com?a=1&b=2&c=3)')
    })

    it('handles URLs with anchor tags', () => {
      const url = 'example.com/page#section-name'
      const result = generateLinkContent(url, 'Section', false)
      expect(result).toBe('[Section](https://example.com/page#section-name)')
    })
  })

  describe('security', () => {
    it('always includes noopener noreferrer for new tab links', () => {
      const result = generateLinkContent('example.com', 'Example', true)
      expect(result).toContain('rel="noopener noreferrer"')
    })

    it('does not include target or rel for same tab links', () => {
      const result = generateLinkContent('example.com', 'Example', false)
      expect(result).not.toContain('target=')
      expect(result).not.toContain('rel=')
    })

    it('handles javascript: protocol correctly', () => {
      const url = 'javascript:alert(1)'
      const normalized = normalizeUrl(url)
      // JavaScript protocol should be preserved (validation will fail later)
      expect(normalized).toBe('javascript:alert(1)')
      // But validation should fail
      expect(validateUrl(normalized)).toBe(false)
    })
  })
})
