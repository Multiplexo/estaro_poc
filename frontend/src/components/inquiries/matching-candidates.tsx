import i18n, { useTranslation } from '@/i18n'
import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApi } from '@/hooks/use-api'
import { candidatePageSize, candidateQuery, useMasterDataSearch, type MasterDataKind } from '@/hooks/use-master-data-search'
import type { AgentMatchResult } from '@/lib/inquiry-processing'
import { candidateNumber, candidateTitle } from '@/lib/master-data-candidate'
import { CandidateDetails } from './candidate-details'

interface MatchingOption {
  id: string
  number: string
  label: string
  context?: string
  warnings: string[]
  proposed: boolean
}

function MatchingOptionRow({ option, selected, preselected, disabled, onSelect }: {
  option: MatchingOption; selected: boolean; preselected: boolean; disabled: boolean; onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  return <li>
    <Button variant="ghost" aria-pressed={selected} disabled={disabled} aria-label={t('matching.selectOption', { label: option.label, number: option.number })}
      className={`h-auto min-h-16 w-full flex-wrap justify-start gap-x-3 gap-y-1 rounded-none px-4 py-3 text-left whitespace-normal ${selected ? 'bg-primary/5' : ''}`} onClick={() => onSelect(option.id)}>
      {selected ? <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check aria-hidden="true" className="size-3!" /></span> : <Circle aria-hidden="true" className="size-4 text-muted-foreground" />}
      <span className="min-w-32 flex-1">
        <span className="block text-sm font-medium leading-5 text-foreground [overflow-wrap:anywhere]">{option.label}</span>
        <span className="mt-0.5 block text-xs font-normal leading-5 text-muted-foreground [overflow-wrap:anywhere]">{option.number}{option.context ? ` · ${option.context}` : ''}</span>
        {option.warnings.length ? <span className="block text-xs font-normal text-amber-800 dark:text-amber-300">{option.warnings.join(' · ')}</span> : null}
      </span>
      {selected ? <span className="shrink-0 text-xs font-medium text-primary">{preselected ? t('matching.preselected') : t('matching.selected')}</span> : option.proposed ? <Badge variant="outline" className="shrink-0">{t('matching.recommended')}</Badge> : null}
    </Button>
  </li>
}

export function MatchingCandidates({ kind, result, selectedId, selectedLabel, disabled, outdated = false, onSelect }: {
  kind: MasterDataKind; result?: AgentMatchResult; selectedId?: string; selectedLabel?: string | null
  disabled: boolean; outdated?: boolean; onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const [searchOpen, setSearchOpen] = useState(false)
  const proposedCandidate = result?.selected ?? result?.alternatives[0]
  const effectiveSelectedId = selectedId ?? proposedCandidate?.entity_id
  const details = useQuery(candidateQuery(api, kind, effectiveSelectedId))
  const search = useMasterDataSearch(kind, '', { searchOnDemand: true })
  const searching = search.search.trim().length > 0
  const busy = searching && (search.waiting || search.results.isPending)
  const candidates = [...new Map([...(result?.selected ? [result.selected] : []), ...(result?.alternatives ?? [])].map((candidate) => [candidate.entity_id, candidate])).values()].slice(0, 5)
  const suggestions: MatchingOption[] = candidates.map((candidate) => ({
    id: candidate.entity_id, number: `${candidate.number}${candidate.variant ? ` / ${candidate.variant}` : ''}`,
    label: candidate.label || t('common.withoutDescription'), warnings: [], proposed: candidate.entity_id === proposedCandidate?.entity_id,
  }))
  const options: MatchingOption[] = searching ? (search.results.data?.items ?? []).flatMap((candidate) => {
    if (candidate.id == null) return []
    const warnings = [
      !candidate.is_active ? t('common.inactive') : null,
      'delivery_blocked' in candidate && candidate.delivery_blocked ? t('common.deliveryBlocked') : null,
      'is_saleable' in candidate && !candidate.is_saleable ? t('matching.notSaleable') : null,
    ].filter((warning): warning is string => !!warning)
    return [{
      id: String(candidate.id), number: candidateNumber(candidate), label: candidateTitle(candidate),
      context: 'customer_number' in candidate ? [candidate.postal_code, candidate.city].filter(Boolean).join(' ') : candidate.description_2 ?? undefined,
      warnings, proposed: String(candidate.id) === proposedCandidate?.entity_id,
    }]
  }) : suggestions
  const selectedSuggestion = suggestions.find((candidate) => candidate.id === effectiveSelectedId)
  const pinnedSelection: MatchingOption | undefined = effectiveSelectedId && !options.some((option) => option.id === effectiveSelectedId) ? {
    id: effectiveSelectedId,
    number: details.data ? candidateNumber(details.data) : selectedSuggestion?.number ?? '',
    label: details.data ? candidateTitle(details.data) : selectedSuggestion?.label || selectedLabel || t('matching.loadingSelection'),
    warnings: [], proposed: effectiveSelectedId === proposedCandidate?.entity_id,
  } : undefined
  const select = (candidateId: string) => { if (candidateId !== selectedId) onSelect(candidateId) }

  return <div className="space-y-3">
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <p className="text-xs font-medium text-muted-foreground">{searching ? !busy && search.results.data ? t('matching.resultCount', { count: search.results.data.total }) : t('matching.searchResults') : t('matching.suggestionsHeading', { count: suggestions.length })}</p>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-expanded={searchOpen} aria-controls={`${id}-search`} onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) search.setSearch('') }}><Search aria-hidden="true" />{searchOpen ? t('matching.closeSearch') : t('matching.searchInventory')}</Button>
      </div>
      {searchOpen ? <div id={`${id}-search`} className="border-b p-3">
        <label htmlFor={id} className="sr-only">{kind === 'customers' ? t('matching.selectOrSearchCustomer') : t('matching.selectOrSearchArticle')}</label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input id={id} type="search" name={`${kind}-matching-search`} value={search.search} onChange={(event) => search.setSearch(event.target.value)} autoComplete="off" spellCheck={false} maxLength={200}
            placeholder={kind === 'customers' ? t('matching.customerSearchPlaceholder') : t('matching.articleSearchPlaceholder')} aria-controls={`${id}-options`} className="h-10 bg-card pr-10 pl-9" />
          {search.search ? <Button variant="ghost" size="icon" className="absolute top-1 right-1" aria-label={t('matching.clearSearch')} onClick={() => search.setSearch('')}><X aria-hidden="true" /></Button> : null}
        </div>
      </div> : null}
      {pinnedSelection ? <ul className="border-b"><MatchingOptionRow option={pinnedSelection} selected preselected={!selectedId} disabled={disabled} onSelect={select} /></ul> : null}
      <div id={`${id}-options`} aria-busy={busy}>
        <div role="status" className="sr-only">{busy ? t('matching.searching') : searching ? t('matching.resultCount', { count: search.results.data?.total ?? 0 }) : t('matching.suggestionCount', { count: options.length })}</div>
        {busy ? <p className="p-4 text-sm text-muted-foreground">{t('matching.searching')}</p> : searching && search.results.isError ? <div role="alert" className="space-y-2 p-4"><p className="text-sm text-destructive">{search.results.error.message}</p><Button variant="outline" size="sm" onClick={() => void search.results.refetch()}>{t('matching.retrySearch')}</Button></div> : options.length ? <ul className="divide-y">{options.map((option) => <MatchingOptionRow key={option.id} option={option} selected={effectiveSelectedId === option.id} preselected={!selectedId} disabled={disabled} onSelect={select} />)}</ul> : <div className="p-4 text-sm text-muted-foreground"><p>{searching ? t('matching.emptySearch') : t('matching.noSuggestions')}</p>{!searchOpen ? <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => setSearchOpen(true)}><Search aria-hidden="true" />{kind === 'customers' ? t('matching.searchCustomers') : t('matching.searchArticles')}</Button> : null}</div>}
      </div>
      {searching && (search.results.data?.total ?? 0) > candidatePageSize ? <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
        <span className="text-xs text-muted-foreground">{t('table.resultRange', { start: search.offset + 1, end: Math.min(search.offset + candidatePageSize, search.results.data!.total), total: search.results.data!.total })}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" aria-label={t('matching.previousResults')} disabled={busy || search.offset === 0} onClick={() => search.setOffset(Math.max(0, search.offset - candidatePageSize))}><ChevronLeft aria-hidden="true" /></Button>
          <Button variant="outline" size="icon" aria-label={t('matching.nextResults')} disabled={busy || search.offset + candidatePageSize >= search.results.data!.total} onClick={() => search.setOffset(search.offset + candidatePageSize)}><ChevronRight aria-hidden="true" /></Button>
        </div>
      </div> : null}
    </div>
    {result && (result.reason || result.conflicts.length > 0) ? <details className="group rounded-lg bg-muted/25 px-3 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-3 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{t('matching.reasonAndHints')}{result.conflicts.length ? <span className="ml-2 font-medium text-amber-800 dark:text-amber-300">{t('matching.hintCount', { count: result.conflicts.length })}</span> : null}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-2 border-t pt-3 text-sm leading-6">
        {result.reason ? <p className="[overflow-wrap:anywhere]">{result.reason}</p> : null}
        {result.selected ? <p className="text-xs text-muted-foreground">{t('matching.confidence', { value: new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 0 }).format(result.confidence) })}</p> : null}
        {result.conflicts.length ? <ul className="list-inside list-disc space-y-1 text-amber-800 dark:text-amber-300">{result.conflicts.map((conflict, index) => <li key={index}>{conflict}</li>)}</ul> : <p className="text-xs text-muted-foreground">{t('matching.noConflicts')}</p>}
        {outdated ? <p className="text-xs text-muted-foreground">{t('matching.outdatedSuggestions')}</p> : null}
      </div>
    </details> : null}
    {details.isError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><p className="text-destructive">{details.error.message}</p><Button size="sm" variant="outline" onClick={() => void details.refetch()}>{t('common.reload')}</Button></div> : null}
    {details.data ? <details className="text-sm"><summary className="w-fit cursor-pointer py-1 text-muted-foreground">{t('matching.selectedMasterData')}</summary><div className="pt-3"><CandidateDetails candidate={details.data} /></div></details> : null}
  </div>
}
