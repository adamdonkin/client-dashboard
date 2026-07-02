export function tiptapToPlainText(content: any): string {
  if (!content?.content) return ''
  const lines: string[] = []

  function walkList(items: any[], indent: number) {
    for (const item of items) {
      if (item.type !== 'listItem' || !item.content) continue
      for (const child of item.content) {
        if (child.type === 'paragraph') {
          lines.push(`${'  '.repeat(indent)}• ${paragraphText(child)}`)
        } else if (child.type === 'bulletList' || child.type === 'orderedList') {
          walkList(child.content || [], indent + 1)
        }
      }
    }
  }

  for (const node of content.content) {
    if (node.type === 'heading') {
      if (lines.length > 0) lines.push('')
      lines.push(inlineText(node))
    } else if (node.type === 'paragraph') {
      const text = paragraphText(node)
      if (text) lines.push(text)
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      walkList(node.content || [], 0)
    } else if (node.type === 'blockquote' && node.content) {
      for (const child of node.content) {
        if (child.type === 'paragraph') {
          lines.push(`> ${paragraphText(child)}`)
        }
      }
    }
  }

  return lines.filter(l => l.length > 0).join('\n')
}

export function tiptapToHtml(content: any): string {
  if (!content?.content) return ''
  const parts: string[] = []

  function walkList(items: any[], tag: string) {
    parts.push(`<${tag}>`)
    for (const item of items) {
      if (item.type !== 'listItem' || !item.content) continue
      parts.push('<li>')
      for (const child of item.content) {
        if (child.type === 'paragraph') {
          parts.push(inlineHtml(child))
        } else if (child.type === 'bulletList') {
          walkList(child.content || [], 'ul')
        } else if (child.type === 'orderedList') {
          walkList(child.content || [], 'ol')
        }
      }
      parts.push('</li>')
    }
    parts.push(`</${tag}>`)
  }

  for (const node of content.content) {
    if (node.type === 'heading') {
      parts.push(`<p><b>${escapeHtml(inlineText(node))}</b></p>`)
    } else if (node.type === 'paragraph') {
      const text = inlineHtml(node)
      if (text) parts.push(`<p>${text}</p>`)
    } else if (node.type === 'bulletList') {
      walkList(node.content || [], 'ul')
    } else if (node.type === 'orderedList') {
      walkList(node.content || [], 'ol')
    } else if (node.type === 'blockquote' && node.content) {
      parts.push('<blockquote>')
      for (const child of node.content) {
        if (child.type === 'paragraph') {
          parts.push(`<p>${inlineHtml(child)}</p>`)
        }
      }
      parts.push('</blockquote>')
    }
  }

  return parts.join('')
}

export async function copyTiptapContent(content: any) {
  const plain = tiptapToPlainText(content)
  const html = tiptapToHtml(content)

  if (!plain) return false

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([plain], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    }),
  ])
  return true
}

function paragraphText(node: any): string {
  return inlineText(node)
}

function inlineText(node: any): string {
  if (!node.content) return ''
  return node.content
    .map((c: any) => c.text || '')
    .join('')
}

function inlineHtml(node: any): string {
  if (!node.content) return ''
  return node.content
    .map((c: any) => {
      let text = escapeHtml(c.text || '')
      if (!c.marks) return text
      for (const mark of c.marks) {
        if (mark.type === 'bold') text = `<b>${text}</b>`
        if (mark.type === 'italic') text = `<i>${text}</i>`
      }
      return text
    })
    .join('')
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
