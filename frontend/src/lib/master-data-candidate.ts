import i18n from '../i18n'
import type { ArticleResponse, CustomerResponse } from './inquiry-models'

export type MasterDataCandidate = ArticleResponse | CustomerResponse

export function candidateTitle(candidate: MasterDataCandidate): string {
  return 'customer_number' in candidate
    ? candidate.name ?? i18n.t('common.withoutName')
    : candidate.description_1 ?? i18n.t('common.withoutDescription')
}

export function candidateNumber(candidate: MasterDataCandidate): string {
  return 'customer_number' in candidate
    ? candidate.customer_number
    : `${candidate.article_number}${candidate.variant ? ` / ${candidate.variant}` : ''}`
}
