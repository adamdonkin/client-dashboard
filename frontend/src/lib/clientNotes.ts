// Client notes started as Markdown in clients.notes and are now Tiptap JSON in
// clients.notes_content. clients.notes is kept as a Markdown copy for pre-reads.

function inlineNodes(text: string): any[] {
  const nodes: any[] = []
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_/g
  let last = 0
  for (const m of text.matchAll(pattern)) {
    if (m.index! > last) nodes.push({ type: 'text', text: text.slice(last, m.index) })
    const bold = m[1] ?? m[2]
    nodes.push(bold !== undefined
      ? { type: 'text', text: bold, marks: [{ type: 'bold' }] }
      : { type: 'text', text: m[3] ?? m[4], marks: [{ type: 'italic' }] })
    last = m.index! + m[0].length
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) })
  return nodes
}

const paragraph = (text: string) => ({ type: 'paragraph', ...(text ? { content: inlineNodes(text) } : {}) })

interface ListLine { indent: number; ordered: boolean; text: string }

function buildList(lines: ListLine[], start: number, indent: number): [any, number] {
  const ordered = lines[start].ordered
  const list: any = { type: ordered ? 'orderedList' : 'bulletList', content: [] }
  let i = start
  while (i < lines.length && lines[i].indent >= indent) {
    if (lines[i].indent > indent) {
      const [nested, next] = buildList(lines, i, lines[i].indent)
      const lastItem = list.content[list.content.length - 1]
      if (lastItem) lastItem.content.push(nested)
      else list.content.push({ type: 'listItem', content: [paragraph(''), nested] })
      i = next
      continue
    }
    list.content.push({ type: 'listItem', content: [paragraph(lines[i].text)] })
    i++
  }
  return [list, i]
}

/** The Markdown subset the old notes box used: headings, bullets, numbered lists, bold, italic */
export function markdownToDoc(markdown: string): any {
  const content: any[] = []
  const rows = markdown.replace(/\r\n/g, '\n').split('\n')
  let listLines: ListLine[] = []

  const flushList = () => {
    let i = 0
    while (i < listLines.length) {
      const [list, next] = buildList(listLines, i, listLines[i].indent)
      content.push(list)
      i = next
    }
    listLines = []
  }

  for (const row of rows) {
    const item = row.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
    if (item) {
      listLines.push({ indent: item[1].replace(/\t/g, '  ').length, ordered: /\d/.test(item[2]), text: item[3] })
      continue
    }
    flushList()
    const heading = row.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      content.push({ type: 'heading', attrs: { level: heading[1].length }, content: inlineNodes(heading[2]) })
    } else if (row.trim()) {
      content.push(paragraph(row.trim()))
    }
  }
  flushList()

  return { type: 'doc', content: content.length ? content : [paragraph('')] }
}

function inlineMarkdown(node: any): string {
  if (node.type === 'text') {
    const marks = (node.marks ?? []).map((m: any) => m.type)
    let text = node.text ?? ''
    if (marks.includes('italic')) text = `*${text}*`
    if (marks.includes('bold')) text = `**${text}**`
    return text
  }
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(inlineMarkdown).join('')
}

/** Markdown copy of the notes for pre-reads. Images are left out. */
export function docToMarkdown(doc: any): string {
  const out: string[] = []
  const walk = (node: any, depth: number) => {
    switch (node.type) {
      case 'heading':
        out.push(`${'#'.repeat(node.attrs?.level ?? 1)} ${inlineMarkdown(node)}`)
        return
      case 'paragraph': {
        const text = inlineMarkdown(node)
        if (text.trim()) out.push(text)
        return
      }
      case 'bulletList':
      case 'orderedList':
        ;(node.content ?? []).forEach((item: any, i: number) => {
          const marker = node.type === 'orderedList' ? `${i + 1}.` : '-'
          const [first, ...rest] = item.content ?? []
          out.push(`${'  '.repeat(depth)}${marker} ${first ? inlineMarkdown(first) : ''}`)
          rest.forEach((child: any) => walk(child, depth + 1))
        })
        return
      case 'image':
        return
      default:
        ;(node.content ?? []).forEach((child: any) => walk(child, depth))
    }
  }
  walk(doc, 0)
  return out.join('\n').trim()
}
