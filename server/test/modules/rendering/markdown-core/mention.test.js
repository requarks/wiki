const MarkdownIt = require('markdown-it')
const mentionPlugin = require('../../../../modules/rendering/markdown-core/mention.js')

describe('mentionPlugin', () => {
  let md

  beforeAll(() => {
    md = new MarkdownIt()
    md.use(mentionPlugin)
  })

  test('renders mention correctly', () => {
    const input = 'Hello @user@example.com'
    const expectedOutput = '<p>Hello <span class="mention" data-mention="user@example.com">@user@example.com</span></p>\n'
    expect(md.render(input)).toBe(expectedOutput)
  })

  test('ignores text without mention', () => {
    const input = 'Hello user'
    const expectedOutput = '<p>Hello user</p>\n'
    expect(md.render(input)).toBe(expectedOutput)
  })

  test('handles multiple mentions', () => {
    const input = 'Hello @user1@example.com and @user2@example.com'
    const expectedOutput = '<p>Hello <span class="mention" data-mention="user1@example.com">@user1@example.com</span> and <span class="mention" data-mention="user2@example.com">@user2@example.com</span></p>\n'
    expect(md.render(input)).toBe(expectedOutput)
  })
})
