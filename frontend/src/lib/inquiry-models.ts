import type { Article, Customer, ExtractedField, FileType, Inquiry as ApiInquiry, InquiryDocument } from './generated/Api'

export type ArticleResponse = Article
export type ArticleDetail = Article
export type CustomerResponse = Customer
export type CustomerDetail = Customer
export type PipelineStep = 'preparation' | 'extraction' | 'matching'
export type JobStatus = 'queued' | 'running' | 'cancelling' | 'cancelled' | 'completed' | 'failed'
export interface JobSummary {
  id: string
  status: JobStatus
  step: PipelineStep | null
  current_step?: string | null
  completed_steps: number
  total_steps?: number
  attempts: number
  last_error: string | null
}
export type DocumentResponse = InquiryDocument & { id: string }
export type InquiryResponse = Omit<ApiInquiry, 'id' | 'documents'> & { id: string; documents: DocumentResponse[]; processing_job: JobSummary | null }
export interface PageInquiryResponse { items: InquiryResponse[]; total: number }
export interface SourceReference {
  document_id: string
  filename: string
  section_id: string
  quote: string
  page?: number | null
  start: number
  end: number
  rectangles?: { x: number; y: number; width: number; height: number }[]
}
export type VerifiedField = Omit<ExtractedField, 'citations' | 'status'> & {
  status: ExtractedField['status'] | 'unverified'
  sources?: SourceReference[]
}
export interface VerifiedItem {
  article: VerifiedField
  material: VerifiedField
  dimensions: VerifiedField
  quantity: VerifiedField
  unit: VerifiedField
  requirements: VerifiedField
  alternatives: VerifiedField
  certificates: VerifiedField
}
export interface MatchCandidate {
  id: string
  number: string
  label?: string | null
  status: 'matching' | 'different' | 'unresolved'
  reasons?: string[]
}
export interface MatchingResult {
  status: 'completed' | 'failed' | 'cancelled'
  targets?: { field_id: string; candidates?: MatchCandidate[] }[]
}
export interface ExtractionResult {
  review_mode?: 'fields'
  customer: VerifiedField
  customer_number?: VerifiedField
  customer_location?: VerifiedField
  contact_name?: VerifiedField
  contact_email?: VerifiedField
  contact_phone?: VerifiedField
  inquiry_number?: VerifiedField
  document_number?: VerifiedField
  offer_valid_until?: VerifiedField
  reference_number: VerifiedField
  requirements: VerifiedField
  delivery_date?: VerifiedField
  items: VerifiedItem[]
  customer_match: {
    status: 'matched' | 'unmatched' | 'ambiguous'
    candidates?: { id: string; customer_number: string; name: string | null; reason: string }[]
  }
  matching?: MatchingResult | null
}
export interface ReviewedField { value: string; confirmed: boolean }
export interface InquiryReview {
  revision?: number
  fields?: Record<string, ReviewedField>
  customer_id?: string | null
  article_ids?: Record<string, string>
  position_confirmations?: Record<string, { origin?: 'manual'; confirmed_at: string | null }>
}
export interface ReadingPage { number: number; width: number; height: number }
export interface ReadingSource {
  id: string
  filename: string
  file_type: FileType
  parent_document_id?: string | null
  sections?: { id: string; text: string; page?: number | null }[]
  pages?: ReadingPage[]
  warnings?: string[]
}
export interface AnalysisResponse {
  job_id?: string | null
  sources?: ReadingSource[]
  extraction?: ExtractionResult | null
  review?: InquiryReview
}
export type InquiryOverview = InquiryResponse & AnalysisResponse & {
  file_types: FileType[]
  customer_name: string | null
  email: string | null
  email_received_at: string | null
  subject: string | null
  reference_number: string | null
  review_status: 'new' | 'in_review' | 'reviewed'
}
export interface PageInquiryOverview { items: InquiryOverview[]; total: number }
export interface SettingsUpdate {
  provider: 'openai' | 'ollama'
  base_url: string
  model: string
  timeout_seconds: number
  context_window: number
  max_output_tokens: number
  vision_enabled: boolean
  vision_model: string | null
  max_visual_pages: number
}
export type SettingsResponse = SettingsUpdate
