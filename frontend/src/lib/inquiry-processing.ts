import type { ApiClient } from './api'
import type { ExtractionJobStatus, InquiryData, RequestParams } from './generated/Api'

export interface AgentMatchCandidate {
  entity_id: string
  number: string
  label: string | null
  variant?: string | null
  reason?: string | null
  conflicts?: string[]
}

export interface AgentMatchResult {
  selected: AgentMatchCandidate | null
  alternatives: AgentMatchCandidate[]
  confidence: number
  reason: string
  conflicts: string[]
  requires_review: boolean
  accessories?: AgentMatchCandidate[]
}

export interface AdditionalPosition {
  zu_position: number
  entity_id: string
  artikel?: string | null
  bezeichnung?: string | null
  menge?: string | null
  mengeneinheit?: string | null
}

export interface AccessoryChange {
  position_index: number
  entity_id: string
  selected: boolean
}

export function additionalPositions(data?: InquiryData | null): AdditionalPosition[] {
  return (data as { zusatzpositionen?: AdditionalPosition[] } | null | undefined)?.zusatzpositionen ?? []
}

export type MatchingProcessingJob = Pick<ExtractionJobStatus, 'id' | 'status' | 'error'> & {
  extraction_job_id: string
  input_revision: number
  input_data: InquiryData
  result: {
    customer: AgentMatchResult
    articles: (AgentMatchResult & { position_index: number })[]
  } | null
}

export interface MatchSelection {
  category: 'customer' | 'article'
  entity_id: string
  position_index?: number
}

export function matchingFinished(status?: MatchingProcessingJob['status']): boolean {
  return status === 'succeeded' || status === 'failed'
}

export async function retryInquiryMatching(api: ApiClient, jobId: string) {
  return (await api.request<MatchingProcessingJob>({
    path: `/extractions/${jobId}/matching`, method: 'POST', format: 'json',
  })).data
}

export async function getInquiryExtractionJob(api: ApiClient, inquiryId: string, params: RequestParams = {}) {
  return (await api.request<ExtractionJobStatus | null>({
    path: `/inquiries/${inquiryId}/extraction-job`, method: 'GET', format: 'json', ...params,
  })).data
}

export async function restartInquiryExtraction(api: ApiClient, inquiryId: string) {
  return (await api.request<ExtractionJobStatus>({
    path: `/inquiries/${inquiryId}/extractions`, method: 'POST', format: 'json',
  })).data
}

export async function getInquiryMatchingJob(api: ApiClient, jobId: string, params: RequestParams = {}) {
  return (await api.request<MatchingProcessingJob>({
    path: `/extractions/${jobId}/matching`, method: 'GET', format: 'json', ...params,
  })).data
}
