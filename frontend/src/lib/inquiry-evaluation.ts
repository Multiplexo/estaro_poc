import i18n from '../i18n'
import type { ExtractionResult, MatchCandidate } from './inquiry-models'
import { analysisFields, fieldStyles, isCustomerIdentityField, type AnalysisField, type AnalysisResult } from './inquiry-analysis'
import { positionKey, reviewedField, type ReviewDraft } from './inquiry-review'
import type { TrafficLight } from './inquiry-traffic-light'

const requiredKinds = new Set(['article', 'material', 'dimensions', 'quantity', 'unit', 'customer'])
const noCandidates: MatchCandidate[] = []
const noFields: AnalysisField[] = []

export function createInquiryEvaluation(result: AnalysisResult & Pick<ExtractionResult, 'customer_match' | 'matching'>, fields = analysisFields(result)) {
  const sharedFields: AnalysisField[] = []
  const customerFields: AnalysisField[] = []
  const positions = new Map<string, AnalysisField[]>()
  for (const entry of fields) {
    const key = positionKey(entry.id)
    if (key) {
      const group = positions.get(key)
      if (group) group.push(entry)
      else positions.set(key, [entry])
    } else sharedFields.push(entry)
    if (isCustomerIdentityField(entry.id)) customerFields.push(entry)
  }
  const targets = new Map((result.matching?.targets ?? []).map((target) => [target.field_id, target.candidates ?? noCandidates]))
  const legacySuggestions: MatchCandidate[] = (result.customer_match.candidates ?? []).map((candidate) => ({
    id: candidate.id, number: candidate.customer_number, label: candidate.name,
    status: 'unresolved', reasons: [candidate.reason],
  }))
  const fieldsFor = (key: string) => positions.get(key) ?? noFields
  const changed = (entries: AnalysisField[], review: ReviewDraft) =>
    entries.some((entry) => reviewedField(entry, review).value !== (entry.field.value ?? ''))
  const candidateFor = (key: string, selectedId?: string | null) => {
    const candidates = targets.get(key) ?? noCandidates
    return selectedId ? candidates.find((candidate) => candidate.id === selectedId) : candidates.length === 1 ? candidates[0] : undefined
  }

  return {
    suggestions(review: ReviewDraft, targetId: string): MatchCandidate[] {
      if (targetId === 'customer' ? changed(customerFields, review)
        : changed(sharedFields, review) || changed(fieldsFor(targetId), review)) return noCandidates
      return targets.get(targetId) ?? (targetId === 'customer' ? legacySuggestions : noCandidates)
    },
    positionStatus(review: ReviewDraft, index: number): TrafficLight {
      const key = `item-${index}-article`
      const confirmation = review.position_confirmations[key]
      if (confirmation) return { color: 'green', origin: 'manual', reasons: [i18n.t('traffic.manualReason')], confirmedAt: confirmation.confirmed_at }

      const conflicts: string[] = []
      const open: string[] = []
      for (const entries of [sharedFields, fieldsFor(key)]) {
        for (const entry of entries) {
          const checked = reviewedField(entry, review)
          if (!checked.confirmed && entry.field.status === 'conflict') conflicts.push(i18n.t('traffic.fieldConflict', { label: i18n.t(fieldStyles[entry.kind].labelKey), note: entry.field.note || i18n.t('traffic.conflict') }))
          if (requiredKinds.has(entry.kind) && !checked.value.trim()) open.push(i18n.t('traffic.missing', { label: i18n.t(fieldStyles[entry.kind].labelKey) }))
          if (!checked.confirmed && entry.field.status === 'unverified') open.push(i18n.t('traffic.unverified', { label: i18n.t(fieldStyles[entry.kind].labelKey) }))
          if (review.fields[entry.id]) open.push(i18n.t('traffic.confirmPosition'))
        }
      }
      for (const [targetKey, selectedId, label] of [
        ['customer', review.customer_id, i18n.t('fields.customer')],
        [key, review.article_ids[key], i18n.t('fields.article')],
      ] as const) {
        const candidate = candidateFor(targetKey, selectedId)
        if (candidate?.status === 'different') conflicts.push(...(candidate.reasons?.length ? candidate.reasons : [i18n.t('traffic.masterDifference', { label })]))
        else if (candidate?.status !== 'matching') {
          const legacyCustomer = targetKey === 'customer' && !result.matching && result.customer_match.status === 'matched' &&
            result.customer_match.candidates?.length === 1 && (!selectedId || result.customer_match.candidates[0].id === selectedId)
          if (!legacyCustomer) open.push(i18n.t('traffic.ambiguousAssignment', { label }))
        }
      }
      if (conflicts.length) return { color: 'red', origin: 'system', reasons: [...new Set(conflicts)] }
      if (open.length) return { color: 'yellow', origin: 'system', reasons: [...new Set(open)] }
      return { color: 'green', origin: 'system', reasons: [i18n.t('traffic.complete')] }
    },
  }
}
