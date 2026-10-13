import { format, parseISO } from 'date-fns'
import type { ActionItem } from '@/components/ActionRow'
import { escapeHtml, inlineHtml, inlineText } from '@/utils/tiptap-clipboard'

export interface DescriptionLine {
  plain: string
  html: string
}

export function extractDescriptionLines(content: any, fallbackText?: string | null): DescriptionLine[] {
  if (content) {
    const lines: DescriptionLine[] = []

    function pushParagraph(node: any) {
      const plain = inlineText(node).trim()
      if (plain) lines.push({ plain, html: inlineHtml(node).trim() })
    }

    function walkNodes(nodes: any[]) {
      for (const node of nodes) {
        if (node.type === 'paragraph') {
          pushParagraph(node)
        } else if (node.type === 'listItem' && node.content) {
          for (const child of node.content) {
            if (child.type === 'paragraph') {
              pushParagraph(child)
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
    return lines
  }

  if (fallbackText) {
    return fallbackText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(l => ({ plain: l, html: escapeHtml(l) }))
  }

  return []
}

type CopyableAction = Pick<ActionItem, 'title' | 'due_date' | 'description' | 'description_content'>

// One action as a bullet with its description nested under it.
function formatAction(a: CopyableAction): { plain: string[]; html: string } {
  const date = a.due_date ? ` by ${format(parseISO(a.due_date.length > 10 ? a.due_date.slice(0, 10) : a.due_date), 'MMM d')}` : ''
  const plain = [`• ${a.title}${date}`]
  let html = `<li>${escapeHtml(a.title)}${date}`

  const desc = extractDescriptionLines(a.description_content, a.description)
  if (desc.length > 0) {
    for (const line of desc) {
      plain.push(`  ◦ ${line.plain}`)
    }
    html += `<ul>${desc.map(l => `<li>${l.html}</li>`).join('')}</ul>`
  }

  return { plain, html: `${html}</li>` }
}

async function writeClipboard(plain: string, html: string) {
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([plain], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    }),
  ])
}

export async function copyActionsToClipboard(actions: ActionItem[]) {
  const openActions = actions.filter(a => a.status === 'to_do')
  if (openActions.length === 0) return

  const formatted = openActions.map(formatAction)
  const plain = `Actions:\n${formatted.flatMap(f => f.plain).join('\n')}`
  const html = `<b>Actions:</b><ul>${formatted.map(f => f.html).join('')}</ul>`
  await writeClipboard(plain, html)
}

export async function copyActionToClipboard(action: CopyableAction) {
  const { plain, html } = formatAction(action)
  await writeClipboard(plain.join('\n'), `<ul>${html}</ul>`)
}
