import i18n from '@/i18n'
import type { RuleRectangle } from './rules'

export function pdfRuleSelection(container: HTMLElement): { quote: string; rectangles: RuleRectangle[] } | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null
  const range = selection.getRangeAt(0)
  const page = container.querySelector<HTMLElement>('.react-pdf__Page')
  const textLayer = page?.querySelector('.react-pdf__Page__textContent')
  if (!page || !textLayer) return null
  if (!textLayer.contains(range.startContainer) || !textLayer.contains(range.endContainer)) {
    throw new Error(i18n.t('source.selectionWithinPage'))
  }
  const quote = selection.toString().trim()
  if (!quote) return null
  if (quote.length > 8000) throw new Error(i18n.t('source.selectionTooLong'))
  const bounds = page.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return null
  const rectangles: RuleRectangle[] = []
  const seen = new Set<string>()
  for (const rect of range.getClientRects()) {
    const left = Math.max(bounds.left, rect.left)
    const top = Math.max(bounds.top, rect.top)
    const right = Math.min(bounds.right, rect.right)
    const bottom = Math.min(bounds.bottom, rect.bottom)
    if (right <= left || bottom <= top) continue
    const rectangle = { x: (left - bounds.left) / bounds.width, y: (top - bounds.top) / bounds.height, width: (right - left) / bounds.width, height: (bottom - top) / bounds.height }
    const key = Object.values(rectangle).map((value) => value.toFixed(5)).join(':')
    if (seen.has(key)) continue
    seen.add(key)
    rectangles.push(rectangle)
  }
  if (rectangles.length > 500) throw new Error(i18n.t('source.selectionTooManyRectangles'))
  return rectangles.length ? { quote, rectangles } : null
}
