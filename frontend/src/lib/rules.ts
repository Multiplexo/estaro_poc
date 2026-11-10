import type { ParseKeys } from 'i18next'
import i18n from '@/i18n'
import type { ApiClient } from './api'

export type RuleCategory = 'extraction' | 'matching'
export type RuleSection = 'customer_contact' | 'inquiry_data' | 'articles'
  | 'kundeninformationen' | 'beleginformationen' | 'lieferadresse' | 'rechnungsadresse'
  | 'kopftext' | 'belegdetails' | 'preisUndSteuerbasis' | 'angebotsdetails' | 'positionen'
export type RuleRectangle = { x: number; y: number; width: number; height: number }
export interface RuleSource {
  inquiry_id: string | null
  document_id: string | null
  page: number
  quote: string
  rectangles: RuleRectangle[]
}
export interface RuleInput {
  title: string
  instruction: string
  category: RuleCategory
  section: RuleSection | null
  is_active: boolean
}
export interface Rule extends RuleInput {
  id: string
  source: RuleSource | null
  created_at: string
  updated_at: string
}

export const ruleCategoryKeys: Record<RuleCategory, ParseKeys> = { extraction: 'jobs.extraction', matching: 'jobs.matching' }

export const ruleSections: Record<RuleCategory, readonly RuleSection[]> = {
  extraction: ['customer_contact', 'inquiry_data', 'articles'],
  matching: ['kundeninformationen', 'beleginformationen', 'lieferadresse', 'rechnungsadresse', 'kopftext', 'belegdetails', 'preisUndSteuerbasis', 'angebotsdetails', 'positionen'],
}

export const ruleSectionKeys: Record<RuleSection, ParseKeys> = {
  customer_contact: 'review.customerSection',
  inquiry_data: 'review.requestSection',
  articles: 'navigation.articles',
  kundeninformationen: 'schema.groups.kundeninformationen',
  beleginformationen: 'schema.groups.beleginformationen',
  lieferadresse: 'schema.groups.lieferadresse',
  rechnungsadresse: 'schema.groups.rechnungsadresse',
  kopftext: 'schema.groups.kopftext',
  belegdetails: 'schema.groups.belegdetails',
  preisUndSteuerbasis: 'schema.groups.preisUndSteuerbasis',
  angebotsdetails: 'schema.groups.angebotsdetails',
  positionen: 'traffic.position',
}

export function ruleSectionLabel(section: RuleSection | null | undefined): string {
  return section ? i18n.t(ruleSectionKeys[section]) : i18n.t('rules.uncategorized')
}

export async function listRules(api: ApiClient, documentId: string | undefined, signal: AbortSignal): Promise<Rule[]> {
  const { data } = await api.instance.get<Rule[]>('/rules', { params: { document_id: documentId }, signal })
  return data
}

export async function saveRule(api: ApiClient, input: RuleInput, ruleId?: string, source?: RuleSource): Promise<Rule> {
  const { data } = ruleId
    ? await api.instance.put<Rule>(`/rules/${ruleId}`, input)
    : await api.instance.post<Rule>('/rules', { ...input, source: source ?? null })
  return data
}

export async function deleteRule(api: ApiClient, ruleId: string): Promise<void> {
  await api.instance.delete(`/rules/${ruleId}`)
}
