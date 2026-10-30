import { expect, test } from 'bun:test'
import type { AnalysisField } from '../src/lib/inquiry-analysis'
import { changeReviewField, confirmReviewFields, reviewDraft, reviewedField } from '../src/lib/inquiry-review'

const customer: AnalysisField = { id: 'customer', kind: 'customer', field: { value: 'Muster GmbH', status: 'present', sources: [] } }
const quantity: AnalysisField = { id: 'item-0-quantity', kind: 'quantity', field: { value: '10', status: 'conflict', sources: [] } }

test('changing a confirmed value requires a new check and preserves original evidence', () => {
  const initial = confirmReviewFields(reviewDraft(), [quantity])
  const changed = changeReviewField(initial, quantity, '20')
  expect(reviewedField(quantity, changed)).toEqual({ value: '20', confirmed: false })
  expect(quantity.field.value).toBe('10')
  expect(reviewedField(quantity, initial).confirmed).toBe(true)
})

test('changing the customer name clears its existing master-data assignment', () => {
  const initial = { ...reviewDraft(), customer_id: 'customer-1' }
  expect(changeReviewField(initial, customer, 'Andere GmbH').customer_id).toBeNull()
  expect(changeReviewField(initial, quantity, '20').customer_id).toBe('customer-1')
})

test('confirming a position keeps corrections and does not confirm other fields', () => {
  const initial = changeReviewField(reviewDraft(), quantity, '20')
  const confirmed = confirmReviewFields(initial, [quantity])
  expect(reviewedField(quantity, confirmed)).toEqual({ value: '20', confirmed: true })
  expect(reviewedField(customer, confirmed).confirmed).toBe(false)
})

// These transitions are the review lifecycle used by the hook and all editing views.
import { createReviewState, reviewHasConflict, reviewIsDirty, reviewReducer } from '../src/lib/inquiry-review-state'
import type { Highlight } from '../src/lib/inquiry-analysis'
import { sourceSelection } from '../src/hooks/use-source-navigation'

const revisionOne = { ...reviewDraft(), revision: 1, fields: { customer: { value: 'Remote GmbH', confirmed: true } }, customer_id: 'remote-customer' }

test('a clean refetch adopts the latest review before the next edit or save', () => {
  const refreshed = reviewReducer(createReviewState(), { type: 'receive', review: revisionOne })
  expect(refreshed.draft).toEqual(revisionOne)
  expect(reviewIsDirty(refreshed)).toBe(false)
  const edited = reviewReducer(refreshed, { type: 'change', entry: quantity, value: '20' })
  expect(edited.draft.revision).toBe(1)
  expect(reviewIsDirty(edited)).toBe(true)
})

test('a dirty refetch protects edits and requires explicit conflict resolution', () => {
  const edited = reviewReducer(createReviewState(), { type: 'change', entry: quantity, value: '20' })
  const refreshed = reviewReducer(edited, { type: 'receive', review: revisionOne })
  expect(refreshed.draft).toEqual(edited.draft)
  expect(reviewHasConflict(refreshed)).toBe(true)
  const rebased = reviewReducer(refreshed, { type: 'reapply' })
  expect(rebased.draft).toEqual({ ...revisionOne, fields: { ...revisionOne.fields, [quantity.id]: { value: '20', confirmed: false } } })
  expect(reviewIsDirty(rebased)).toBe(true)
  expect(reviewHasConflict(rebased)).toBe(false)
  const reloaded = reviewReducer(refreshed, { type: 'reload' })
  expect(reloaded.draft).toEqual(revisionOne)
  expect(reviewIsDirty(reloaded)).toBe(false)
})

test('a stale save retains edits until a refreshed revision can resolve the conflict', () => {
  const edited = reviewReducer(createReviewState(), { type: 'change', entry: quantity, value: '20' })
  const rejected = reviewReducer(edited, { type: 'stale' })
  expect(reviewHasConflict(rejected)).toBe(true)
  expect(rejected.draft).toEqual(edited.draft)
  expect(reviewReducer(rejected, { type: 'reapply' })).toBe(rejected)
  const refreshed = reviewReducer(rejected, { type: 'receive', review: revisionOne })
  expect(refreshed.draft).toEqual(edited.draft)
  expect(reviewReducer(refreshed, { type: 'reapply' }).draft.revision).toBe(1)
})

test('successful saves set the baseline, ignore older refetches and keep later edits', () => {
  const edited = reviewReducer(createReviewState(), { type: 'change', entry: quantity, value: '20' })
  const saved = { ...edited.draft, revision: 1 }
  const accepted = reviewReducer(edited, { type: 'saved', review: saved, submitted: edited.draft })
  expect(reviewIsDirty(accepted)).toBe(false)
  expect(reviewReducer(accepted, { type: 'receive', review: reviewDraft() })).toBe(accepted)
  const laterEdit = reviewReducer(edited, { type: 'change', entry: quantity, value: '30' })
  const lateSuccess = reviewReducer(laterEdit, { type: 'saved', review: saved, submitted: edited.draft })
  expect(lateSuccess.draft.fields[quantity.id].value).toBe('30')
  expect(lateSuccess.draft.revision).toBe(1)
  expect(reviewIsDirty(lateSuccess)).toBe(true)
})

test('a newer refetch wins over an older successful save response', () => {
  const edited = reviewReducer(createReviewState(), { type: 'change', entry: quantity, value: '20' })
  const refreshed = reviewReducer(edited, { type: 'receive', review: { ...revisionOne, revision: 2 } })
  const saved = reviewReducer(refreshed, { type: 'saved', review: { ...edited.draft, revision: 1 }, submitted: edited.draft })
  expect(saved.draft.revision).toBe(2)
  expect(saved.draft.fields).toEqual(revisionOne.fields)
  expect(reviewIsDirty(saved)).toBe(false)
})

test('field and citation selection share one intent, and document selection clears it', () => {
  const highlight: Highlight = { id: 'citation-1', fieldId: quantity.id, label: 'Menge', color: '#123456', source: {
    document_id: 'attachment', filename: 'Anhang.pdf', section_id: 'page-2-line-1', page: 2, start: 0, end: 2, quote: '10',
  } }
  const field = reviewReducer(createReviewState(), { type: 'field', entry: quantity, highlights: [highlight] })
  expect(field.selection.documentId).toBe('attachment')
  expect(field.activeFieldId).toBe(quantity.id)
  const filtered = reviewReducer(field, { type: 'filter', onlyOpen: true })
  const source = reviewReducer(filtered, { type: 'highlight', highlight })
  expect(source.activeFieldId).toBe(quantity.id)
  expect(source.onlyOpen).toBe(false)
  expect(source.selection.revision).toBeGreaterThan(field.selection.revision)
  expect(sourceSelection([{ id: 'attachment', file_type: 'pdf', filename: 'Anhang.pdf' }], [highlight], source.selection).active).toEqual(highlight)
  const switched = reviewReducer(source, { type: 'document', id: 'email' })
  expect(switched.activeFieldId).toBeUndefined()
  expect(switched.selection.highlightId).toBeUndefined()
  const withoutCitation = reviewReducer(source, { type: 'field', entry: customer, highlights: [highlight] })
  expect(withoutCitation.selection.highlightId).toBeUndefined()
  expect(withoutCitation.selection.documentId).toBe('attachment')
})


test('reapplying a corrected customer name clears a new remote assignment', () => {
  const edited = reviewReducer(createReviewState(), { type: 'change', entry: customer, value: 'Local GmbH' })
  const refreshed = reviewReducer(edited, { type: 'receive', review: revisionOne })
  const reapplied = reviewReducer(refreshed, { type: 'reapply' })
  expect(reapplied.draft.fields.customer.value).toBe('Local GmbH')
  expect(reapplied.draft.customer_id).toBeNull()
  const confirmed = reviewReducer(createReviewState(), { type: 'confirm', entry: customer })
  const confirmedRefresh = reviewReducer(confirmed, { type: 'receive', review: revisionOne })
  expect(reviewReducer(confirmedRefresh, { type: 'reapply' }).draft.customer_id).toBe('remote-customer')
})

test('changing a position invalidates only its article assignment', () => {
  const saved = { ...reviewDraft(), article_ids: { 'item-0-article': 'variant-a', 'item-1-article': 'variant-b' } }
  const changed = changeReviewField(saved, quantity, '20')
  expect(changed.article_ids).toEqual({ 'item-1-article': 'variant-b' })
  expect(saved.article_ids['item-0-article']).toBe('variant-a')
  expect(changeReviewField(saved, customer, 'Andere GmbH').article_ids).toEqual(saved.article_ids)
})

test('confirmed assignments are saved together and survive a clean refetch', () => {
  const assigned = reviewReducer(createReviewState(), { type: 'assignments', customerId: 'customer', articleIds: { 'item-0-article': 'variant-b' } })
  expect(reviewIsDirty(assigned)).toBe(true)
  expect(assigned.draft.article_ids).toEqual({ 'item-0-article': 'variant-b' })
  const saved = { ...assigned.draft, revision: 1 }
  const accepted = reviewReducer(assigned, { type: 'saved', review: saved, submitted: assigned.draft })
  expect(reviewIsDirty(accepted)).toBe(false)
  expect(reviewReducer(accepted, { type: 'receive', review: { ...saved, revision: 2 } }).draft.article_ids).toEqual(saved.article_ids)
})

test('reapplying a changed position clears remote article selection and preserves unrelated positions', () => {
  const edited = reviewReducer(createReviewState(), { type: 'change', entry: quantity, value: '20' })
  const remote = { ...revisionOne, article_ids: { 'item-0-article': 'remote-a', 'item-1-article': 'remote-b' } }
  const refreshed = reviewReducer(edited, { type: 'receive', review: remote })
  const reapplied = reviewReducer(refreshed, { type: 'reapply' })
  expect(reapplied.draft.article_ids).toEqual({ 'item-1-article': 'remote-b' })
  const clean = reviewReducer(createReviewState(), { type: 'receive', review: remote })
  expect(clean.draft.article_ids).toEqual(remote.article_ids)
})


test('inline article changes invalidate only their position and survive conflict reapplication', () => {
  const original = { ...reviewDraft(), article_ids: { 'item-0-article': 'a', 'item-1-article': 'b' },
    position_confirmations: { 'item-0-article': { origin: 'manual' as const, confirmed_at: null }, 'item-1-article': { origin: 'manual' as const, confirmed_at: null } } }
  const assigned = reviewReducer(createReviewState(original), { type: 'article', fieldId: 'item-0-article', id: 'new' })
  expect(assigned.draft.position_confirmations['item-0-article']).toBeUndefined()
  expect(assigned.draft.position_confirmations['item-1-article']).toBeDefined()
  const received = reviewReducer(assigned, { type: 'receive', review: { ...original, revision: 1, customer_id: 'remote' } })
  const reapplied = reviewReducer(received, { type: 'reapply' })
  expect(reapplied.draft.article_ids).toEqual({ 'item-0-article': 'new', 'item-1-article': 'b' })
  expect(reapplied.draft.customer_id).toBe('remote')
  const removed = reviewReducer(reapplied, { type: 'article', fieldId: 'item-0-article' })
  expect(removed.draft.article_ids).toEqual({ 'item-1-article': 'b' })
})
