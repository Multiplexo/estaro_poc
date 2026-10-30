import { useTranslation } from '@/i18n'
import { useId } from 'react'
import { Check, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { candidatePageSize, useMasterDataSearch, type MasterDataKind } from '@/hooks/use-master-data-search'
import { useIsMobile } from '@/hooks/use-mobile'
import { candidateNumber, candidateTitle } from '@/lib/master-data-candidate'
import type { MatchCandidate } from '@/lib/inquiry-models'

export function InlineMasterDataSearch({ kind, initialSearch, selectedId, suggestions, onSelect }: {
  kind: MasterDataKind; initialSearch: string; selectedId?: string; suggestions: MatchCandidate[]; onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const isMobile = useIsMobile()
  const search = useMasterDataSearch(kind, initialSearch)
  const { results, waiting, offset, setOffset } = search
  const busy = waiting || results.isFetching
  return <div className="space-y-3 border-t pt-3">
    <label htmlFor={id} className="sr-only">{kind === 'customers' ? t('matching.searchCustomers') : t('matching.searchArticles')}</label>
    <div className="relative"><Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input id={id} name={`${kind}-search`} type="search" autoComplete="off" spellCheck={false} autoFocus={!isMobile} value={search.search} maxLength={200} onChange={(event) => search.setSearch(event.target.value)} placeholder={kind === 'customers' ? t('matching.customerPlaceholder') : t('matching.articlePlaceholder')} className="h-10 bg-background pl-9" />
    </div>
    {suggestions.length > 1 ? <div className="space-y-1"><p className="text-xs text-muted-foreground">{t('matching.moreSuggestions')}</p>{suggestions.map((candidate) => <Button key={candidate.id} variant="ghost" className="h-auto min-h-10 w-full justify-start whitespace-normal text-left" disabled={candidate.id == null} onClick={() => { if (candidate.id != null) onSelect(String(candidate.id)) }}>{candidate.number} · {candidate.label}{selectedId === String(candidate.id) ? <Check aria-hidden="true" /> : null}</Button>)}</div> : null}
    <div aria-live="polite" aria-busy={busy} className="max-h-64 space-y-1 overflow-y-auto">
      {busy ? <p role="status" className="p-2 text-sm text-muted-foreground">{t('matching.searching')}</p> : results.isError ? <div role="alert" className="space-y-2 text-sm"><p>{results.error.message}</p><Button variant="outline" onClick={() => void results.refetch()}>{t('matching.retrySearch')}</Button></div> : results.data?.items.map((candidate) => <Button key={candidate.id} variant="ghost" className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal px-2 py-2 text-left" disabled={candidate.id == null} onClick={() => { if (candidate.id != null) onSelect(String(candidate.id)) }}>
        <span className="min-w-0 flex-1"><span className="block text-xs font-normal text-muted-foreground">{candidateNumber(candidate)}{!candidate.is_active ? ` · ${t('common.inactive')}` : ''}{'delivery_blocked' in candidate && candidate.delivery_blocked ? ` · ${t('common.deliveryBlocked')}` : ''}</span><span className="block break-words">{candidateTitle(candidate)}</span></span>{selectedId === String(candidate.id) ? <Check className="text-blue-700" aria-hidden="true" /> : null}
      </Button>)}
      {!busy && results.data?.total === 0 ? <p className="p-2 text-sm text-muted-foreground">{t('matching.noResults')}</p> : null}
    </div>
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{!busy && results.data ? t('matching.resultCount', { count: results.data.total }) : ''}</span><div className="flex gap-1">
      <Button variant="outline" size="icon" aria-label={t('matching.previous')} disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - candidatePageSize))}><ChevronLeft aria-hidden="true" /></Button>
      <Button variant="outline" size="icon" aria-label={t('matching.next')} disabled={busy || !results.data || offset + candidatePageSize >= results.data.total} onClick={() => setOffset(offset + candidatePageSize)}><ChevronRight aria-hidden="true" /></Button>
    </div></div>
  </div>
}
