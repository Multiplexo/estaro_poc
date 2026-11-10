import type { TFunction } from 'i18next'
import i18n from '../i18n'
import type { ExtractionResult, InquiryOverview, MatchCandidate } from './inquiry-models'
import { analysisFields, fieldStyles, isCustomerIdentityField, type AnalysisField, type AnalysisResult } from './inquiry-analysis'
import { positionKey, reviewedField, type ReviewDraft } from './inquiry-review'
import { inquiryTrafficLight, type TrafficLight } from './inquiry-traffic-light'

const requiredKinds = new Set(['article', 'material', 'dimensions', 'quantity', 'unit', 'customer'])
const noCandidates: MatchCandidate[] = []
const noFields: AnalysisField[] = []

export function createInquiryEvaluation(result: AnalysisResult & Pick<ExtractionResult, 'customer_match' | 'matching' | 'review_mode'>, fields = analysisFields(result), t: TFunction = i18n.t) {
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

  const evaluation = {
    suggestions(review: ReviewDraft, targetId: string): MatchCandidate[] {
      if (targetId === 'customer' ? changed(customerFields, review)
        : changed(sharedFields, review) || changed(fieldsFor(targetId), review)) return noCandidates
      return targets.get(targetId) ?? (targetId === 'customer' ? legacySuggestions : noCandidates)
    },
    positionStatus(review: ReviewDraft, index: number): TrafficLight {
      const key = `item-${index}-article`
      const confirmation = review.position_confirmations[key]
      if (result.review_mode === 'fields' && fieldsFor(key).length > 0 && [...sharedFields, ...fieldsFor(key)].every((entry) => reviewedField(entry, review).confirmed)) {
        return { color: 'green', origin: 'manual', reasons: [t('traffic.manualReason')], confirmedAt: null }
      }
      if (result.review_mode !== 'fields' && confirmation) return { color: 'green', origin: 'manual', reasons: [t('traffic.manualReason')], confirmedAt: confirmation.confirmed_at }

      const conflicts: string[] = []
      const open: string[] = []
      for (const entries of [sharedFields, fieldsFor(key)]) {
        for (const entry of entries) {
          const checked = reviewedField(entry, review)
          if (!checked.confirmed && entry.field.status === 'conflict') conflicts.push(t('traffic.fieldConflict', { label: t(fieldStyles[entry.kind].labelKey), note: entry.field.note || t('traffic.conflict') }))
          if (requiredKinds.has(entry.kind) && !checked.value.trim()) open.push(t('traffic.missing', { label: t(fieldStyles[entry.kind].labelKey) }))
          if (!checked.confirmed && entry.field.status === 'unverified') open.push(t('traffic.unverified', { label: t(fieldStyles[entry.kind].labelKey) }))
          if (review.fields[entry.id]) open.push(t('traffic.confirmPosition'))
        }
      }
      for (const [targetKey, selectedId, label] of [
        ['customer', review.customer_id, t('fields.customer')],
        [key, review.article_ids[key], t('fields.article')],
      ] as const) {
        if (result.review_mode === 'fields') continue
        const candidate = candidateFor(targetKey, selectedId)
        if (candidate?.status === 'different') conflicts.push(...(candidate.reasons?.length ? candidate.reasons : [t('traffic.masterDifference', { label })]))
        else if (candidate?.status !== 'matching') {
          const legacyCustomer = targetKey === 'customer' && !result.matching && result.customer_match.status === 'matched' &&
            result.customer_match.candidates?.length === 1 && (!selectedId || result.customer_match.candidates[0].id === selectedId)
          if (!legacyCustomer) open.push(t('traffic.ambiguousAssignment', { label }))
        }
      }
      if (conflicts.length) return { color: 'red', origin: 'system', reasons: [...new Set(conflicts)] }
      if (open.length) return { color: 'yellow', origin: 'system', reasons: [...new Set(open)] }
      return { color: 'green', origin: 'system', reasons: [t('traffic.complete')] }
    },
  }
  return {
    ...evaluation,
    summary(review: ReviewDraft) {
      const positionStatuses = result.items.map((_, index) => evaluation.positionStatus(review, index))
      const openFields = fields.filter((entry) => !reviewedField(entry, review).confirmed)
      const confirmedPositions = positionStatuses.filter((status) => status.origin === 'manual').length
      const assignmentsComplete = result.review_mode === 'fields' || (!!review.customer_id && result.items.length > 0 &&
        result.items.every((_, index) => !!review.article_ids[`item-${index}-article`]))
      const completed = result.items.length > 0 && fields.length > 0 && openFields.length === 0 &&
        confirmedPositions === result.items.length && assignmentsComplete
      const reviewStatus: InquiryOverview['review_status'] = completed ? 'reviewed' : review.revision > 0 ? 'in_review' : 'new'
      return {
        positionStatuses, openFields, confirmedPositions, assignmentsComplete, completed, reviewStatus,
        unconfirmedPositions: positionStatuses.length - confirmedPositions,
        trafficLight: inquiryTrafficLight(positionStatuses),
      }
    },
  }
}
