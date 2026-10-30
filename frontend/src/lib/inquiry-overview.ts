import type { InquiryOverview } from './inquiry-models'
import { analysisFields } from './inquiry-analysis'
import { reviewDraft } from './inquiry-review'
import { inquiryTrafficLight } from './inquiry-traffic-light'
import { createInquiryEvaluation } from './inquiry-evaluation'

export const reviewStatusLabels = { new: 'Neu', in_review: 'In Prüfung', reviewed: 'Geprüft' }

export function inquiryOverview(inquiry: InquiryOverview) {
  const review = reviewDraft(inquiry.review)
  const result = inquiry.extraction
  const fields = result ? analysisFields(result) : []
  const evaluation = result ? createInquiryEvaluation(result, fields) : undefined
  const positions = result?.items.map((_, index) => evaluation!.positionStatus(review, index)) ?? []
  const delivery = review.fields.delivery_date?.value ?? result?.delivery_date?.value
  return {
    ...inquiry,
    title: inquiry.customer_name?.trim() || 'Kunde nicht erkannt',
    description: inquiry.subject || inquiry.reference_number || inquiry.documents.find((document) => !document.parent_document_id)?.filename || 'Anfrage',
    trafficLight: inquiryTrafficLight(positions),
    deliveryDate: delivery?.trim() || null,
  }
}

export type InboxInquiry = ReturnType<typeof inquiryOverview>

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })

export function formatInboxDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unbekannt' : dateFormat.format(date)
}

export function deadlineHint(value: string, now = new Date()) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(value.trim())
  if (!iso && !german) return null
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : [Number(german![3]), Number(german![2]), Number(german![1])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((date.getTime() - today) / 86400000)
  if (days < 0) return { overdue: true, label: `${-days} ${days === -1 ? 'Tag' : 'Tage'} überfällig` }
  if (days === 0) return { overdue: false, label: 'Heute' }
  if (days <= 7) return { overdue: false, label: `${days} ${days === 1 ? 'Tag' : 'Tage'}` }
  return null
}
