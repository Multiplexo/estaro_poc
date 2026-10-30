import type { AnalysisResponse, InquiryResponse, ReadingSource } from './inquiry-models'
import { analysisFields, customerIdentityKinds, itemFieldKinds } from './inquiry-analysis'
import { reviewDraft, reviewedField } from './inquiry-review'
import { inquiryTrafficLight } from './inquiry-traffic-light'
import { createInquiryEvaluation } from './inquiry-evaluation'

export function emailHeader(source: ReadingSource | undefined, id: string) {
  return source?.sections?.find((section) => section.id === id)?.text.replace(/^[^:]+:\s*/, '').trim() || null
}

function extractionNotice(inquiry: InquiryResponse, analysis: AnalysisResponse) {
  if (analysis.extraction) return null
  switch (inquiry.processing_job?.status) {
    case 'cancelled': return 'Die Verarbeitung wurde abgebrochen. Vorhandene E-Mails und Dateien stehen unten zur Verfügung.'
    case 'cancelling': return 'Die Verarbeitung wird abgebrochen. Die Anfrage kann anschließend gelöscht werden.'
    case 'failed': return 'Die Verarbeitung ist fehlgeschlagen. Vorhandene E-Mails und Dateien stehen unten zur Verfügung.'
    case 'queued':
    case 'running': return 'Die Anfrage wird verarbeitet. Die Informationen werden automatisch ergänzt.'
    default: return 'Für diese Anfrage liegen noch keine extrahierten Informationen vor.'
  }
}

export function inquiryDetail(inquiry: InquiryResponse, analysis: AnalysisResponse) {
  const sources = analysis.sources ?? []
  const emails = sources.filter((source) => source.file_type === 'msg')
  const email = emails.find((source) => !source.parent_document_id) ?? emails[0]
  const result = analysis.extraction
  const review = reviewDraft(analysis.review)
  const fields = result ? analysisFields(result) : []
  const evaluation = result ? createInquiryEvaluation(result, fields) : undefined
  const summary = evaluation?.summary(review)
  const values = new Map(fields.map((entry) => [entry.id, reviewedField(entry, review).value]))
  const value = (id: string) => values.get(id)?.trim() || null
  const positions = result?.items.map((_, index) => ({
    number: index + 1,
    fields: itemFieldKinds.map((kind) => ({ kind, value: value(`item-${index}-${kind}`) })),
    status: summary!.positionStatuses[index],
  })) ?? []
  const customerUnchanged = customerIdentityKinds.every((kind) => value(kind) === (result?.[kind]?.value?.trim() || null))
  const suggestions = customerUnchanged ? result?.customer_match : undefined
  const matchingCustomers = customerUnchanged ? result?.matching?.targets?.find((target) => target.field_id === 'customer')?.candidates ?? [] : []
  const customerId = review.customer_id ?? (matchingCustomers.length === 1 && matchingCustomers[0].status === 'matching'
    ? matchingCustomers[0].id
    : suggestions?.status === 'matched' && suggestions.candidates?.length === 1 ? suggestions.candidates[0].id : undefined)
  return {
    title: emailHeader(email, 'subject') || [value('customer'), value('inquiry_number') || value('reference_number')].filter(Boolean).join(' · ') || inquiry.documents.find((document) => !document.parent_document_id)?.filename || 'Anfrage',
    emails, customerId, customerName: value('customer'), sender: emailHeader(email, 'sender'),
    reference: value('reference_number'), inquiryNumber: value('inquiry_number'), documentNumber: value('document_number'),
    offerValidUntil: value('offer_valid_until'), deliveryDate: value('delivery_date'), requirements: value('requirements'),
    customerNumber: value('customer_number'), customerLocation: value('customer_location'),
    contactName: value('contact_name'), contactEmail: value('contact_email'), contactPhone: value('contact_phone'),
    reviewStatus: summary?.reviewStatus ?? 'new', positions, confirmedPositions: summary?.confirmedPositions ?? 0,
    extractionNotice: extractionNotice(inquiry, analysis), matchingStatus: result?.matching?.status,
    openFields: summary?.openFields.length ?? 0,
    fieldCount: fields.length,
    trafficLight: summary?.trafficLight ?? inquiryTrafficLight([]),
  }
}

export type InquiryDetail = ReturnType<typeof inquiryDetail>
