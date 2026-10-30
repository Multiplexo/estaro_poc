import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExtractedField } from '../src/components/inquiries/extracted-field'
import { EmailSource } from '../src/components/inquiries/email-source'
import { PdfHighlights } from '../src/components/inquiries/pdf-highlights'
import { fieldHighlights, sectionSegments, type AnalysisField, type Highlight } from '../src/lib/inquiry-analysis'

const entry: AnalysisField = { id: 'item-0-material', kind: 'material', field: {
  value: '1.4841', status: 'present', sources: [{ document_id: 'document-1', filename: 'Anfrage.msg', section_id: 'body-1', page: null, start: 7, end: 13, quote: '1.4841' }],
} }

test('editable fields label the value and preserve source filename and exact quote', () => {
  const highlights = fieldHighlights([entry])
  const html = renderToStaticMarkup(<ExtractedField entry={entry} highlights={highlights} review={{ value: '1.4841', confirmed: false }} onSelect={() => {}} onChange={() => {}} onFocus={() => {}} onConfirm={() => {}} onReset={() => {}} />)
  expect(html).toContain('Anfrage.msg')
  expect(html).toContain('for="review-item-0-material"')
  expect(html).toContain('Werkstoff: Quelle im Original anzeigen')
  expect(html).toContain('1.4841')
})

test('checked values have an explicit status and remain directly editable', () => {
  const html = renderToStaticMarkup(<ExtractedField entry={entry} highlights={[]} review={{ value: '1.4841', confirmed: true }} onSelect={() => {}} onChange={() => {}} onFocus={() => {}} onConfirm={() => {}} onReset={() => {}} />)
  expect(html).toContain('role="status"')
  expect(html).toContain('Geprüft')
  expect(html).toContain('Werkstoff: Prüfung aufheben')
  expect(html).toContain('value="1.4841"')
  const input = html.match(/<input[^>]*>/)?.[0] ?? ''
  expect(input).not.toMatch(/\s(?:readonly|disabled)(?:=|\s|\/?>)/i)
})

test('overlapping citations keep every character exactly once, including Unicode', () => {
  const text = '🔧 Rohr 1.4841'
  const highlights = fieldHighlights([entry])
  highlights[0].source = { ...highlights[0].source, start: 7, end: 13 }
  const overlapping: Highlight = { ...highlights[0], id: 'second', source: { ...highlights[0].source, start: 2, end: 13 } }
  const segments = sectionSegments(text, [...highlights, overlapping])
  expect(segments.map((segment) => segment.text).join('')).toBe(text)
  expect(segments.find((segment) => segment.text === '1.4841')?.highlights).toHaveLength(2)
})

test('email source renders untrusted markup as text and exposes selected quotations', () => {
  const highlights = fieldHighlights([entry])
  const html = renderToStaticMarkup(<EmailSource source={{ id: 'document-1', filename: 'Anfrage.msg', file_type: 'msg', sections: [{ id: 'body-1', text: '🔧 Rohr 1.4841 <script>bad()</script>' }] }} highlights={highlights} active={highlights[0]} onSelect={() => {}} />)
  expect(html).not.toContain('<script>')
  expect(html).toContain('&lt;script&gt;')
  expect(html).toContain('Werkstoff')
})

test('email citations stay in their own section when their offsets overlap', () => {
  const [first] = fieldHighlights([entry])
  const second: Highlight = { ...first, id: 'second-source', label: 'Zweite Fundstelle', source: { ...first.source, section_id: 'body-2' } }
  const html = renderToStaticMarkup(<EmailSource source={{ id: 'document-1', filename: 'Anfrage.msg', file_type: 'msg', sections: [
    { id: 'body-1', text: '🔧 Rohr 1.4841' }, { id: 'body-2', text: '🔧 Rohr 1.4841' },
  ] }} highlights={[first, second]} active={second} onSelect={() => {}} />)
  expect(html.match(/<button /g)).toHaveLength(2)
  expect(html.match(/title="Werkstoff"/g)).toHaveLength(1)
  expect(html.match(/title="Zweite Fundstelle"/g)).toHaveLength(1)
  expect(html.match(/background-color:#f59e0b99/g)).toHaveLength(1)
})

test('PDF boxes use relative coordinates, field colors and accessible selection on the current page', () => {
  const [highlight] = fieldHighlights([entry])
  highlight.source = { ...highlight.source, page: 1, rectangles: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }] }
  const otherPage: Highlight = { ...highlight, id: 'other-page', label: 'Andere Seite', source: { ...highlight.source, page: 2 } }
  const html = renderToStaticMarkup(<PdfHighlights page={1} highlights={[highlight, otherPage]} active={highlight} onSelect={() => {}} />)
  expect(html).toContain('left:10%;top:20%;width:30%;height:4%')
  expect(html).toContain(highlight.color)
  expect(html).toContain('aria-label="Werkstoff: 1.4841"')
  expect(html).toContain('aria-pressed="true"')
  expect(html).not.toContain('Andere Seite')
})

test('saved references without PDF coordinates retain citations without inventing boxes', () => {
  const highlights = fieldHighlights([entry])
  highlights[0].source = { ...highlights[0].source, page: 1 }
  const html = renderToStaticMarkup(<PdfHighlights page={1} highlights={highlights} onSelect={() => {}} />)
  expect(html).not.toContain('<button')
})
