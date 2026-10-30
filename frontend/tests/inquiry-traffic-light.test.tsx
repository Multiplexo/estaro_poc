import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { TrafficLightBadge } from '../src/components/inquiries/traffic-light-badge'
import type { ExtractionResult, VerifiedField, VerifiedItem } from '../src/lib/generated/Api'
import { analysisFields } from '../src/lib/inquiry-analysis'
import { changeReviewField, confirmPositions, reviewDraft } from '../src/lib/inquiry-review'
import { createReviewState, reviewIsDirty, reviewReducer } from '../src/lib/inquiry-review-state'
import { inquiryTrafficLight } from '../src/lib/inquiry-traffic-light'
import { createInquiryEvaluation } from '../src/lib/inquiry-evaluation'

const field = (value: string | null, status: VerifiedField['status'] = 'present'): VerifiedField => ({ value, status, sources: [] })

// Same Rohr/material/dimensions/quantity as tests.helpers.documents.inquiry_pdf.
function sample(): ExtractionResult {
  const item: VerifiedItem = {
    article: field('Rohr'), material: field('1.4841'), dimensions: field('60 x 3 x 6000 mm'),
    quantity: field('10'), unit: field('Stück'), requirements: field('entgratet'),
    certificates: field('3.1'), alternatives: field(null, 'missing'),
  }
  return {
    customer: field('Muster GmbH'), reference_number: field('A-2026-49'), requirements: field(null, 'missing'),
    items: [item, structuredClone(item)], customer_match: { status: 'matched', note: '' },
    metadata: { model: 'test', processing_version: 'test' },
    matching: { targets: ['customer', 'item-0-article', 'item-1-article'].map((field_id) => ({
      field_id, candidates: [{ id: field_id, number: field_id, label: field_id, status: 'matching', reasons: ['Passend'] }],
    })) },
  }
}

function positionTrafficLight(result: ExtractionResult, review: ReturnType<typeof reviewDraft>, index: number) {
  return createInquiryEvaluation(result).positionStatus(review, index)
}

test('complete sample positions with unambiguous matching are system green', () => {
  const result = sample()
  expect(positionTrafficLight(result, reviewDraft(), 0)).toMatchObject({ color: 'green', origin: 'system' })
  result.items[0].unit = field(null, 'missing')
  expect(positionTrafficLight(result, reviewDraft(), 0)).toMatchObject({ color: 'yellow', reasons: ['Einheit fehlt'] })
})

test('ambiguous/unresolved matching and unsupported evidence are yellow; known conflicts are red', () => {
  const result = sample()
  const target = result.matching!.targets![1]
  target.candidates = [...target.candidates!, { ...target.candidates![0], id: 'other' }]
  expect(positionTrafficLight(result, reviewDraft(), 0).color).toBe('yellow')
  target.candidates = [{ ...target.candidates[0], status: 'unresolved' }]
  expect(positionTrafficLight(result, reviewDraft(), 0).color).toBe('yellow')
  target.candidates[0].status = 'different'
  target.candidates[0].reasons = ['Abweichende Werkstoffnummer 1.4301']
  expect(positionTrafficLight(result, reviewDraft(), 0)).toMatchObject({ color: 'red', reasons: ['Abweichende Werkstoffnummer 1.4301'] })
  target.candidates[0].status = 'matching'
  result.items[0].quantity = field('10 / 20', 'conflict')
  expect(positionTrafficLight(result, reviewDraft(), 0).color).toBe('red')
  result.items[0].quantity = field('10', 'unverified')
  expect(positionTrafficLight(result, reviewDraft(), 0).color).toBe('yellow')
})

test('technical stop reasons do not change the business traffic light', () => {
  const result = sample()
  for (const status of ['completed', 'timeout', 'model_error', 'tool_limit', 'model_limit', 'context_limit'] as const) {
    result.matching!.status = status
    const business = positionTrafficLight(result, reviewDraft(), 0)
    expect(business.color).toBe('green')
    expect(business.reasons.join(' ')).not.toMatch(/timeout|model_error|limit/)
  }
})

test('individual and bulk confirmations accept conflicts, retain provenance and require reconfirmation after edits', () => {
  const result = sample()
  result.items[0].quantity = field('10 / 20', 'conflict')
  const fields = analysisFields(result)
  const first = fields.filter((entry) => entry.id.startsWith('item-0-'))
  const confirmed = confirmPositions(reviewDraft(), first)
  expect(positionTrafficLight(result, confirmed, 0)).toMatchObject({ color: 'green', origin: 'manual' })
  expect(positionTrafficLight(result, confirmed, 1).origin).toBe('system')
  const bulk = confirmPositions(confirmed, fields.filter((entry) => entry.id.startsWith('item-')))
  expect(inquiryTrafficLight(result.items.map((_, index) => positionTrafficLight(result, bulk, index)))).toMatchObject({ color: 'green', origin: 'manual' })
  const quantity = first.find((entry) => entry.kind === 'quantity')!
  const changed = changeReviewField(bulk, quantity, '20')
  expect(positionTrafficLight(result, changed, 0)).toMatchObject({ color: 'red', origin: 'system' })
  expect(positionTrafficLight(result, changed, 1).origin).toBe('manual')
  expect(positionTrafficLight(result, confirmPositions(changed, first), 0).origin).toBe('manual')
  const shared = changeReviewField(bulk, fields.find((entry) => entry.id === 'requirements')!, '3.2')
  expect(shared.position_confirmations).toEqual({})
})

test('changing assignments invalidates affected confirmations even when every field remains checked', () => {
  const result = sample()
  const fields = analysisFields(result).filter((entry) => entry.id.startsWith('item-'))
  const draft = confirmPositions({ ...reviewDraft(), customer_id: 'customer', article_ids: { 'item-0-article': 'a', 'item-1-article': 'b' } }, fields)
  const state = createReviewState(draft)
  const assigned = reviewReducer(state, { type: 'assignments', customerId: 'customer', articleIds: { 'item-0-article': 'new', 'item-1-article': 'b' } })
  expect(assigned.draft.position_confirmations['item-0-article']).toBeUndefined()
  expect(assigned.draft.position_confirmations['item-1-article']).toBeDefined()
  expect(positionTrafficLight(result, assigned.draft, 0).color).toBe('yellow')
  const unchanged = reviewReducer(state, { type: 'assignments', customerId: 'customer', articleIds: draft.article_ids })
  expect(reviewIsDirty(unchanged)).toBe(false)
  expect(changeReviewField(draft, fields[0], fields[0].field.value!)).toBe(draft)
  expect(reviewReducer(state, { type: 'change', entry: fields[0], value: fields[0].field.value! })).toBe(state)
})

test('reapplying local confirmation over remotely changed position cannot approve the new values', () => {
  const result = sample()
  const fields = analysisFields(result).filter((entry) => entry.id.startsWith('item-'))
  const local = reviewReducer(createReviewState(), { type: 'confirmGroup', entries: fields })
  const remote = { ...reviewDraft(), revision: 1, article_ids: { 'item-0-article': 'different' } }
  const received = reviewReducer(local, { type: 'receive', review: remote })
  const rebased = reviewReducer(received, { type: 'reapply' })
  expect(rebased.draft.position_confirmations['item-0-article']).toBeUndefined()
  expect(rebased.draft.position_confirmations['item-1-article']).toBeDefined()
})

test('aggregate status prioritizes conflicts, and empty requests remain yellow', () => {
  expect(inquiryTrafficLight([]).color).toBe('yellow')
  expect(inquiryTrafficLight([{ color: 'yellow', origin: 'system', reasons: [] }, { color: 'red', origin: 'system', reasons: [] }]).color).toBe('red')
})

test('a save response keeps the server confirmation timestamp while unrelated edits remain dirty', () => {
  const result = sample()
  const fields = analysisFields(result)
  const local = reviewReducer(createReviewState(), { type: 'confirmGroup', entries: fields.filter((entry) => entry.id.startsWith('item-0-')) })
  const later = reviewReducer(local, { type: 'change', entry: fields.find((entry) => entry.id === 'item-1-quantity')!, value: '20' })
  const saved = { ...local.draft, revision: 1, position_confirmations: { 'item-0-article': { origin: 'manual' as const, confirmed_at: '2026-10-28T10:30:00Z' } } }
  const accepted = reviewReducer(later, { type: 'saved', review: saved, submitted: local.draft })
  expect(accepted.draft.position_confirmations).toEqual(saved.position_confirmations)
  expect(accepted.draft.fields['item-1-quantity'].value).toBe('20')
  expect(reviewIsDirty(accepted)).toBe(true)
})

test('badges communicate color, provenance, explanation and saved time without color alone', () => {
  const html = renderToStaticMarkup(<TrafficLightBadge label="Position 1" status={{ color: 'green', origin: 'manual', reasons: [], confirmedAt: '2026-10-28T10:30:00Z' }} />)
  expect(html).toContain('Position 1: Grün, manuell bestätigt')
  expect(html).toContain('Bestätigt am')
  const conflict = renderToStaticMarkup(<TrafficLightBadge status={{ color: 'red', origin: 'system', reasons: ['Abweichende Werkstoffnummer'] }} />)
  expect(conflict).toContain('Abweichende Werkstoffnummer')
})
