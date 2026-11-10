import type { TFunction } from 'i18next'
import i18n from '@/i18n'
import type { InquiryOverview } from './inquiry-models'
import { analysisFields } from './inquiry-analysis'
import { reviewDraft } from './inquiry-review'
import { inquiryTrafficLight } from './inquiry-traffic-light'
import { createInquiryEvaluation } from './inquiry-evaluation'

export const PAGE_SIZE = 25

export const reviewStatusKeys = { new: 'inquiries.status.new', in_review: 'inquiries.status.in_review', reviewed: 'common.checked' } as const

export function inquiryOverview(inquiry: InquiryOverview, t: TFunction = i18n.t) {
  const review = reviewDraft(inquiry.review)
  const result = inquiry.extraction
  const fields = result ? analysisFields(result) : []
  const evaluation = result ? createInquiryEvaluation(result, fields, t) : undefined
  const summary = evaluation?.summary(review)
  const delivery = review.fields.delivery_date?.value ?? result?.delivery_date?.value
  return {
    ...inquiry,
    title: inquiry.customer_name?.trim() || t('inquiries.customerNotRecognized'),
    description: inquiry.subject || inquiry.reference_number || inquiry.documents.find((document) => !document.parent_document_id)?.filename || t('inquiries.singular'),
    review_status: summary?.reviewStatus ?? 'new',
    trafficLight: summary?.trafficLight ?? inquiryTrafficLight([]),
    deliveryDate: delivery?.trim() || null,
  }
}

export type InboxInquiry = ReturnType<typeof inquiryOverview>

export function formatInboxDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? i18n.t('common.unknown') : new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(date)
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
  if (days < 0) return { overdue: true, label: i18n.t('inquiries.overdueDays', { count: -days }) }
  if (days === 0) return { overdue: false, label: i18n.t('inquiries.dueToday') }
  if (days <= 7) return { overdue: false, label: i18n.t('inquiries.remainingDays', { count: days }) }
  return null
}
