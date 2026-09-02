const MarkdownIt = require('markdown-it')
const taskListsRenderer = require('../../../../server/modules/rendering/markdown-tasklists/renderer')

describe('rendering/markdown-tasklists', () => {
  it('renders interactive task list checkboxes', () => {
    const md = new MarkdownIt()

    taskListsRenderer.init(md, {})

    const result = md.render('- [ ] unchecked\n- [x] checked')

    expect(result).toContain('class="task-list-item enabled"')
    expect(result).toContain('class="task-list-item-checkbox"')
    expect(result).toContain('checked=""')
    expect(result).not.toContain('disabled="disabled"')
  })
})
