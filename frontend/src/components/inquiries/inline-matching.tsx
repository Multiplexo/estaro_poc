import { useTranslation } from '@/i18n'
import { lazy, Suspense } from 'react'
import { Check, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useInlineMatching } from '@/hooks/use-inline-matching'
import type { MasterDataKind } from '@/hooks/use-master-data-search'
import type { MatchCandidate } from '@/lib/inquiry-models'
import { candidateNumber, candidateTitle } from '@/lib/master-data-candidate'
import { CandidateDetails } from './candidate-details'

const InlineMasterDataSearch = lazy(() => import('./inline-master-data-search').then((module) => ({ default: module.InlineMasterDataSearch })))

export function InlineMatching({ kind, selectedId, suggestions, initialSearch, onSelect }: {
  kind: MasterDataKind; selectedId?: string; suggestions: MatchCandidate[]; initialSearch: string; onSelect: (id?: string) => void
}) {
  const { t } = useTranslation()
  const matching = useInlineMatching(kind, selectedId, suggestions, onSelect)
  const { details, suggestion, selected } = matching
  const title = details.data ? candidateTitle(details.data) : suggestion?.label
  const number = details.data ? candidateNumber(details.data) : suggestion?.number
  return <section aria-label={kind === 'customers' ? t('matching.customers') : t('matching.articles')} className="space-y-3 border-b bg-muted/20 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-muted-foreground">{selected ? t('matching.assignedMaster') : kind === 'customers' ? t('matching.customerSuggestion') : t('matching.articleSuggestion')}</p>
      {selected ? <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Check aria-hidden="true" />{t('matching.assigned')}</Badge> : suggestion ? <Badge variant="outline" className={suggestion.status === 'matching' ? 'border-emerald-200 text-emerald-700' : suggestion.status === 'different' ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-800'}>{suggestion.status === 'matching' ? t('matching.matching') : suggestion.status === 'different' ? t('matching.different') : t('matching.compare')}</Badge> : null}
    </div>
    {title || number ? <div><p className="text-base font-semibold break-words">{title || t('common.withoutDescription')}</p><p className="mt-0.5 text-sm text-muted-foreground">{number}</p></div> : <p className="text-sm text-muted-foreground">{selected ? t('matching.loadingAssignment') : t('matching.noSuggestion')}</p>}
    {details.isError ? <div role="alert" className="space-y-2 text-xs text-destructive"><p>{details.error.message}</p><Button size="sm" variant="outline" onClick={() => void details.refetch()}>{t('matching.retryDetails')}</Button></div> : null}
    <div className="flex flex-wrap gap-2">
      {!selected && suggestion ? <Button size="sm" className="min-h-9 bg-blue-700 hover:bg-blue-800" disabled={!details.isSuccess || details.isFetching} onClick={matching.accept}><Check aria-hidden="true" />{t('matching.accept')}</Button> : null}
      <Button size="sm" variant="ghost" className="min-h-9 text-muted-foreground" aria-expanded={matching.searching} onClick={() => matching.setSearching(!matching.searching)}><Search aria-hidden="true" />{matching.searching ? t('matching.closeSearch') : selected ? t('matching.changeAssignment') : t('matching.searchMaster')}</Button>
    </div>
    {details.data || selected ? <details className="text-sm"><summary className="w-fit cursor-pointer py-1 text-muted-foreground">{t('matching.details')}</summary><div className="space-y-4 pt-3">{suggestion?.reasons?.length ? <ul className="list-inside list-disc space-y-1 text-muted-foreground">{suggestion.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}{details.data ? <CandidateDetails candidate={details.data} /> : null}{selected ? <Button size="sm" variant="outline" onClick={() => matching.select(undefined)}>{t('matching.removeAssignment')}</Button> : null}</div></details> : details.isFetching ? <p role="status" className="text-sm text-muted-foreground">{t('matching.loadingMaster')}</p> : null}
    {matching.searching ? <Suspense fallback={<p role="status" className="text-xs">{t('matching.loadingSearch')}</p>}><InlineMasterDataSearch kind={kind} initialSearch={initialSearch} selectedId={selectedId} suggestions={suggestions} onSelect={matching.select} /></Suspense> : null}
  </section>
}
