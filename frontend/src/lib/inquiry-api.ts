import type { ApiClient } from './api'
import type { ExtractedField, ExtractionJobStatus, ExtractionReview, Inquiry, InquiryExtraction, RequestParams } from './generated/Api'
import type { AnalysisResponse, ExtractionResult, InquiryOverview, InquiryResponse, InquiryReview, JobSummary, PageInquiryOverview, VerifiedField } from './inquiry-models'
import { createInquiryEvaluation } from './inquiry-evaluation'
import { reviewDraft } from './inquiry-review'

export function inquiryReview(review?: ExtractionReview): InquiryReview {
  return {
    revision: review?.revision ?? 0,
    fields: Object.fromEntries(Object.entries(review?.fields ?? {}).map(([id, field]) => [id, { ...field, value: field.value ?? '' }])),
  }
}

export function jobSummary(job: ExtractionJobStatus): JobSummary {
  return {
    id: job.id, status: job.status === 'succeeded' ? 'completed' : job.status,
    step: null, current_step: job.current_step, completed_steps: job.completed_steps,
    total_steps: job.total_steps, attempts: 0, last_error: job.error,
  }
}

export function inquiryResponse(inquiry: Inquiry): InquiryResponse {
  if (!inquiry.id) throw new Error('Die Anfrage hat keine ID.')
  const documents = (inquiry.documents ?? []).map((document) => {
    if (!document.id) throw new Error('Das Dokument hat keine ID.')
    return { ...document, id: document.id }
  })
  return { ...inquiry, id: inquiry.id, documents, processing_job: null }
}

function extractionResult(result: InquiryExtraction, inquiry: InquiryResponse): ExtractionResult {
  const documentsById = new Map(inquiry.documents.map((document) => [document.id, document]))
  const field = (value: ExtractedField | undefined): VerifiedField => ({
    value: value?.value ?? null, status: value?.status ?? 'missing', note: value?.note,
    sources: (value?.citations ?? []).map((citation) => ({
      document_id: citation.document_id,
      filename: documentsById.get(citation.document_id)?.filename ?? 'Dokument',
      section_id: citation.section_id, quote: citation.quote,
      page: citation.page_number, start: 0, end: Array.from(citation.quote).length,
      rectangles: citation.bbox && citation.page_width && citation.page_height ? [{
        x: citation.bbox.l / citation.page_width, y: citation.bbox.t / citation.page_height,
        width: (citation.bbox.r - citation.bbox.l) / citation.page_width,
        height: (citation.bbox.b - citation.bbox.t) / citation.page_height,
      }] : [],
    })),
  })
  return {
    review_mode: 'fields',
    customer: field(result.customer), customer_number: field(result.customer_number),
    customer_location: field(result.customer_location), contact_name: field(result.contact_name),
    contact_email: field(result.contact_email), contact_phone: field(result.contact_phone),
    inquiry_number: field(result.inquiry_number), document_number: field(result.document_number),
    offer_valid_until: field(result.offer_valid_until), reference_number: field(result.reference_number),
    requirements: field(result.requirements), delivery_date: field(result.delivery_date),
    items: result.items.map((item) => ({
      article: field(item.article), material: field(item.material), dimensions: field(item.dimensions),
      quantity: field(item.quantity), unit: field(item.unit), requirements: field(item.requirements),
      alternatives: field(item.alternatives), certificates: field(item.certificates),
    })),
    customer_match: { status: 'unmatched', candidates: [] },
  }
}

export async function loadAnalysis(api: ApiClient, inquiry: InquiryResponse, params: RequestParams = {}): Promise<AnalysisResponse> {
  const { data } = await api.inquiries.listInquiryExtractions(inquiry.id, { limit: 1 }, params)
  return {
    job_id: data[0]?.job_id,
    sources: inquiry.documents.map((document) => ({ ...document, sections: [] })),
    extraction: data[0] ? extractionResult(data[0].result, inquiry) : null,
    review: inquiryReview(data[0]?.review),
  }
}

export async function loadAll<T>(load: (query: { offset: number; limit: number }) => Promise<{ data: T[] }>): Promise<T[]> {
  const items: T[] = []
  const limit = 1000
  for (let offset = 0; ; offset += limit) {
    const { data } = await load({ offset, limit })
    items.push(...data)
    if (data.length < limit) return items
  }
}

export type InquiryOverviewQuery = NonNullable<Parameters<ApiClient['inquiries']['listInquiryOverviews']>[0]>

export async function loadInquiryOverviews(api: ApiClient, query: InquiryOverviewQuery, params: RequestParams = {}): Promise<PageInquiryOverview> {
  const { data } = await api.inquiries.listInquiryOverviews(query, params)
  const items = data.items.map((inquiry): InquiryOverview => {
    const { latest_extraction: snapshot, ...record } = inquiry
    const normalized = inquiryResponse(record)
    const extraction = extractionResult(snapshot.result, normalized)
    const review = inquiryReview(snapshot.review)
    const summary = createInquiryEvaluation(extraction).summary(reviewDraft(review))
    return {
      ...normalized, extraction, review, job_id: snapshot.job_id,
      file_types: [...new Set(normalized.documents.map((document) => document.file_type))],
      customer_name: review.fields?.customer?.value ?? extraction.customer.value ?? null,
      email: review.fields?.contact_email?.value ?? extraction.contact_email?.value ?? null,
      email_received_at: null, subject: null,
      reference_number: review.fields?.inquiry_number?.value ?? extraction.inquiry_number?.value ?? review.fields?.reference_number?.value ?? extraction.reference_number.value ?? null,
      review_status: summary.reviewStatus,
    }
  })
  return { items, total: data.total }
}
