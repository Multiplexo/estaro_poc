import type { InquiryReview, ReviewedField } from './inquiry-models'
import { customerFieldKinds, isCustomerIdentityField, offerFieldKinds, type AnalysisField } from './inquiry-analysis'

export type ReviewDraft = Required<InquiryReview>

export interface ReviewPosition {
  key: string
  sectionId: string
  index: number
  fields: AnalysisField[]
}

const customerKinds = new Set<string>(customerFieldKinds)
const offerKinds = new Set<string>(offerFieldKinds)

export function reviewDraft(review?: InquiryReview): ReviewDraft {
  return { revision: review?.revision ?? 0, fields: review?.fields ?? {}, customer_id: review?.customer_id ?? null, article_ids: review?.article_ids ?? {}, position_confirmations: review?.position_confirmations ?? {} }
}

export function positionKey(fieldId: string): string | undefined {
  const match = /^item-(\d+)-/.exec(fieldId)
  return match ? `item-${match[1]}-article` : undefined
}

export function fieldAffectsPosition(fieldId: string, key: string): boolean {
  const owner = positionKey(fieldId)
  return owner === undefined || owner === key
}

export function reviewSection(fieldId?: string): string | undefined {
  if (!fieldId) return undefined
  const key = positionKey(fieldId)
  return key ? key.replace(/-article$/, '') : customerKinds.has(fieldId) ? 'customer' : 'request'
}

export function reviewFieldGroups(fields: AnalysisField[]) {
  const customerFields: AnalysisField[] = []
  const requestFields: AnalysisField[] = []
  const offerFields: AnalysisField[] = []
  const positions = new Map<string, ReviewPosition>()
  for (const entry of fields) {
    const key = positionKey(entry.id)
    if (key) {
      let position = positions.get(key)
      if (!position) {
        position = { key, sectionId: reviewSection(entry.id)!, index: Number(key.split('-')[1]), fields: [] }
        positions.set(key, position)
      }
      position.fields.push(entry)
    } else if (customerKinds.has(entry.id)) customerFields.push(entry)
    else if (offerKinds.has(entry.id)) offerFields.push(entry)
    else requestFields.push(entry)
  }
  return { customerFields, inquiryFields: [...requestFields, ...offerFields], positions: [...positions.values()] }
}

export function equalReviewField(a: ReviewedField | undefined, b: ReviewedField | undefined): boolean {
  return a?.value === b?.value && a?.confirmed === b?.confirmed
}

export function positionFieldsChanged(before: ReviewDraft, after: ReviewDraft, key: string, includeShared = true): boolean {
  return [...new Set([...Object.keys(before.fields), ...Object.keys(after.fields)])].some((id) =>
    (includeShared ? fieldAffectsPosition(id, key) : positionKey(id) === key) && !equalReviewField(before.fields[id], after.fields[id]))
}

export function changedArticleAssignments(before: ReviewDraft, after: ReviewDraft): string[] {
  return [...new Set([...Object.keys(before.article_ids), ...Object.keys(after.article_ids)])]
    .filter((key) => before.article_ids[key] !== after.article_ids[key])
}

export function changeReviewAssignments(review: ReviewDraft, customerId: string | null, articleIds: Record<string, string>): ReviewDraft {
  const next = { ...review, customer_id: customerId, article_ids: articleIds }
  if (customerId !== review.customer_id) return invalidatePositionConfirmations(next)
  const confirmations = { ...review.position_confirmations }
  for (const key of changedArticleAssignments(review, next)) delete confirmations[key]
  return { ...next, position_confirmations: confirmations }
}

export function toggleReviewField(review: ReviewDraft, entry: AnalysisField): ReviewDraft {
  const field = reviewedField(entry, review)
  const next = field.confirmed ? invalidatePositionConfirmations(review, positionKey(entry.id)) : review
  return { ...next, fields: { ...next.fields, [entry.id]: { ...field, confirmed: !field.confirmed } } }
}

export function equalConfirmation(a: ReviewDraft['position_confirmations'][string] | undefined, b: ReviewDraft['position_confirmations'][string] | undefined): boolean {
  return !!a === !!b && a?.confirmed_at === b?.confirmed_at
}

export function reapplyPositionConfirmations(baseline: ReviewDraft, local: ReviewDraft, latest: ReviewDraft, draft: ReviewDraft) {
  const confirmations = { ...latest.position_confirmations }
  for (const key of new Set([...Object.keys(local.position_confirmations), ...Object.keys(baseline.position_confirmations)])) {
    if (!equalConfirmation(local.position_confirmations[key], baseline.position_confirmations[key])) {
      if (local.position_confirmations[key]) confirmations[key] = local.position_confirmations[key]
      else delete confirmations[key]
    }
  }
  for (const key of Object.keys(confirmations)) {
    const source = confirmations[key] === local.position_confirmations[key] ? local : latest
    if (source.customer_id !== draft.customer_id || source.article_ids[key] !== draft.article_ids[key] ||
      positionFieldsChanged(source, draft, key)) delete confirmations[key]
  }
  return confirmations
}

function invalidatePositionConfirmations(review: ReviewDraft, fieldId?: string): ReviewDraft {
  const position_confirmations = { ...review.position_confirmations }
  if (fieldId) delete position_confirmations[fieldId]
  return { ...review, position_confirmations: fieldId ? position_confirmations : {} }
}

export function reviewedField(entry: AnalysisField, review: ReviewDraft): ReviewedField {
  return review.fields[entry.id] ?? { value: entry.field.value ?? '', confirmed: false }
}

export function changeReviewField(review: ReviewDraft, entry: AnalysisField, value: string): ReviewDraft {
  if (reviewedField(entry, review).value === value) return review
  const articleIds = { ...review.article_ids }
  const key = positionKey(entry.id)
  if (key) delete articleIds[key]
  return {
    ...invalidatePositionConfirmations(review, key),
    // A changed value must be checked again, even if it was previously confirmed.
    fields: { ...review.fields, [entry.id]: { value, confirmed: false } },
    customer_id: isCustomerIdentityField(entry.id) ? null : review.customer_id,
    article_ids: articleIds,
  }
}

export function confirmReviewFields(review: ReviewDraft, entries: AnalysisField[]): ReviewDraft {
  return { ...review, fields: { ...review.fields, ...Object.fromEntries(entries.map((entry) => [entry.id, { ...reviewedField(entry, review), confirmed: true }])) } }
}

export function confirmPositions(review: ReviewDraft, entries: AnalysisField[]): ReviewDraft {
  const checked = confirmReviewFields(review, entries)
  const confirmations = { ...checked.position_confirmations }
  for (const entry of entries) {
    const key = positionKey(entry.id)
    if (key && !confirmations[key]) confirmations[key] = { origin: 'manual', confirmed_at: null }
  }
  return { ...checked, position_confirmations: confirmations }
}
