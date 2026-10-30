import type { ApiClient } from './api'
import type { ExtractedField, ExtractionJobStatus, Inquiry, InquiryExtraction, RequestParams } from './generated/Api'
import type { AnalysisResponse, ExtractionResult, InquiryOverview, InquiryResponse, JobSummary, VerifiedField } from './inquiry-models'

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
  const field = (value: ExtractedField | undefined): VerifiedField => ({
    value: value?.value ?? null, status: value?.status ?? 'missing', note: value?.note,
    sources: (value?.citations ?? []).map((citation) => ({
      document_id: citation.document_id,
      filename: inquiry.documents.find((document) => document.id === citation.document_id)?.filename ?? 'Dokument',
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

export async function loadInquiryOverviews(api: ApiClient, params: RequestParams = {}): Promise<InquiryOverview[]> {
  const inquiries = await loadAll((query) => api.inquiries.listInquiries(query, params))
  const overviews = await Promise.all(inquiries.map(async (inquiry): Promise<InquiryOverview | null> => {
    const normalized = inquiryResponse(inquiry)
    const analysis = await loadAnalysis(api, normalized, params)
    if (!analysis.extraction) return null
    return {
      ...normalized, ...analysis,
      file_types: [...new Set(normalized.documents.map((document) => document.file_type))],
      customer_name: analysis.extraction?.customer.value ?? null,
      email: analysis.extraction?.contact_email?.value ?? null,
      email_received_at: null, subject: null,
      reference_number: analysis.extraction?.inquiry_number?.value ?? analysis.extraction?.reference_number.value ?? null,
      review_status: 'new' as const,
    }
  }))
  return overviews.filter((inquiry): inquiry is InquiryOverview => inquiry !== null)
}
