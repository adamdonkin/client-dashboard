import { format, parseISO } from 'date-fns'
import type { ActionItem } from '@/components/ActionRow'

export function extractDescriptionLines(content: any, fallbackText?: string | null): string[] {
  if (content) {
    const lines: string[] = []

    function paragraphText(node: any): string {
      if (!node.content) return ''
      return node.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text || '')
        .join('')
        .trim()
    }

    function walkNodes(nodes: any[]) {
      for (const node of nodes) {
        if (node.type === 'paragraph') {
          const text = paragraphText(node)
          if (text) lines.push(text)
        } else if (node.type === 'listItem' && node.content) {
          for (const child of node.content) {
            if (child.type === 'paragraph') {
              const text = paragraphText(child)
              if (text) lines.push(text)
            } else if (child.type === 'bulletList' || child.type === 'orderedList') {
              if (child.content) walkNodes(child.content)
            }
          }
        } else if (node.type === 'bulletList' || node.type === 'orderedList') {
          if (node.content) walkNodes(node.content)
        }
      }
    }

    if (content.content) walkNodes(content.content)
    return lines.filter(l => l.length > 0)
  }

  if (fallbackText) {
    return fallbackText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  }

  return []
}

export async function copyActionsToClipboard(actions: ActionItem[]) {
  const openActions = actions.filter(a => a.status === 'to_do')
  if (openActions.length === 0) return

  const plainLines: string[] = []
  const htmlParts: string[] = []

  for (const a of openActions) {
    const date = a.due_date ? ` by ${format(parseISO(a.due_date.length > 10 ? a.due_date.slice(0, 10) : a.due_date), 'MMM d')}` : ''
    plainLines.push(`• ${a.title}${date}`)
    htmlParts.push(`<li>${a.title}${date}`)

    const desc = extractDescriptionLines(a.description_content, a.description)
    if (desc.length > 0) {
      for (const line of desc) {
        plainLines.push(`  ◦ ${line}`)
      }
      htmlParts.push(`<ul>${desc.map(l => `<li>${l}</li>`).join('')}</ul>`)
    }

    htmlParts.push('</li>')
  }

  const plain = `Actions:\n${plainLines.join('\n')}`
  const html = `<b>Actions:</b><ul>${htmlParts.join('')}</ul>`

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([plain], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    }),
  ])
}
