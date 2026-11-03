import { Building2, Check, ChevronLeft, ChevronRight, Database, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { InquiryMatching } from '@/hooks/use-inquiry-matching'
import type { ReviewEditor } from '@/hooks/use-inquiry-review'
import type { MasterDataKind } from '@/hooks/use-master-data-search'
import type { ExtractionResult, InquiryResponse } from '@/lib/inquiry-models'
import type { AgentMatchResult } from '@/lib/inquiry-processing'
import { MatchingCandidates } from './matching-candidates'
import { MatchingExtraction } from './matching-extraction'

interface MatchingTarget {
  key: string
  label: string
  request: string
  kind: MasterDataKind
  positionIndex?: number
  selectedId?: string
  selectedLabel?: string | null
  result?: AgentMatchResult
}

function targetStatus(target: MatchingTarget): string {
  if (target.selectedId) return 'Zugeordnet'
  return target.result?.selected || target.result?.alternatives.length ? 'Vorschlag vorhanden' : 'Offen'
}

export function InquiryMatchingPanel({ matching, editor, extraction, inquiry, dirty, activeKey, onTargetChange }: {
  matching: InquiryMatching; editor: ReviewEditor; inquiry?: InquiryResponse; dirty: boolean
  extraction: ExtractionResult
  activeKey: string; onTargetChange: (key: string) => void
}) {
  const { job, selection, running } = matching
  const disabled = editor.disabled || dirty || running || selection.isPending || !matching.available
  const data = inquiry?.daten
  const provenance = data?.matching_provenance ?? {}
  const customer = provenance['kundeninformationen.kunde']
  const targets: MatchingTarget[] = [{
    key: 'customer', label: 'Kunde', kind: 'customers',
    request: extraction.customer.value || 'Kein Kunde angegeben',
    selectedId: customer?.value === data?.kundeninformationen?.kunde ? customer?.entity_id : undefined,
    selectedLabel: data?.kundeninformationen?.name,
    result: job.data?.result?.customer,
  }, ...editor.positions.map((position): MatchingTarget => {
    const article = provenance[`positionen.${position.index}.artikel`]
    const stored = data?.positionen?.[position.index]
    return {
      key: position.key, label: `Position ${position.index + 1}`, kind: 'articles', positionIndex: position.index,
      request: extraction.items[position.index]?.article.value || 'Ohne Bezeichnung',
      selectedId: article?.value === stored?.artikel ? article?.entity_id : undefined,
      selectedLabel: stored?.bezeichnung,
      result: job.data?.result?.articles.find((match) => match.position_index === position.index),
    }
  })]
  const activeIndex = Math.max(0, targets.findIndex((target) => target.key === activeKey))
  const active = targets[activeIndex]
  const assigned = targets.filter((target) => !!target.selectedId).length

  return <div className="@container p-4 sm:p-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <p>Zuordnungen werden direkt gespeichert.</p>
      <div role="status" aria-live="polite">{selection.isPending ? 'Zuordnung wird gespeichert …' : selection.isSuccess ? <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-3.5" />Zuordnung gespeichert</span> : `${assigned} von ${targets.length} zugeordnet`}</div>
    </div>
    <div className="space-y-3 text-sm leading-6 [&:has(>*)]:mb-5">
      {dirty ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Bitte zuerst die Änderungen an den Anfragedaten speichern, um Zuordnungen zu ändern.</p> : null}
      {!matching.available ? <p role="status">Für diese Anfrage liegt keine zuordenbare Extraktion vor.</p> : null}
      {job.isLoading || running ? <p role="status">{running ? 'Matching-Agenten suchen passende Kunden und Artikel …' : 'Matching-Ergebnisse werden geladen …'}</p> : null}
      {job.isError ? <div role="alert" className="space-y-2"><p className="text-destructive">{job.error.message}</p><Button variant="outline" onClick={() => void job.refetch()}>Erneut laden</Button></div> : null}
      {job.data?.status === 'failed' ? <p role="alert" className="text-destructive">Matching fehlgeschlagen. Kunden und Artikel können über die Suche manuell zugeordnet werden.</p> : null}
      {job.isSuccess && !job.data ? <p role="status">Es liegen noch keine Matching-Ergebnisse vor. Kunden und Artikel können über die Suche zugeordnet werden.</p> : null}
      {selection.isError ? <p role="alert" className="text-destructive">Zuordnung konnte nicht gespeichert werden: {selection.error.message}</p> : null}
    </div>
    <div className="grid min-w-0 items-start gap-5 @min-[48rem]:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="@min-[48rem]:hidden">
        <label htmlFor="matching-target" className="mb-2 block text-xs font-medium text-muted-foreground">Kunde oder Position auswählen</label>
        <NativeSelect id="matching-target" value={active.key} onChange={(event) => onTargetChange(event.target.value)} className="w-full [&_select]:h-11">
          {targets.map((target) => <NativeSelectOption key={target.key} value={target.key}>{target.label} · {target.request} · {targetStatus(target)}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <nav aria-label="Matching für Kunde und Positionen" className="sticky top-5 hidden min-w-0 @min-[48rem]:block">
        <p className="mb-3 px-3 text-xs font-medium text-muted-foreground">Kunde & Positionen <span className="ml-1 tabular-nums">{targets.length}</span></p>
        <div className="max-h-[60dvh] space-y-1 overflow-y-auto p-1">
          {targets.map((target) => <Button key={target.key} variant="ghost" aria-current={target.key === active.key ? 'true' : undefined} aria-controls="matching-active-detail" onClick={() => onTargetChange(target.key)}
            className={`h-auto min-h-20 w-full justify-start gap-3 px-3 py-3 text-left whitespace-normal ${target.key === active.key ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>
            {target.kind === 'customers' ? <Building2 aria-hidden="true" className="size-4 shrink-0" /> : <span aria-hidden="true" className="w-4 shrink-0 text-xs tabular-nums">{target.positionIndex! + 1}</span>}
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{target.label}</span><span className="mt-0.5 block truncate text-xs font-normal" title={target.request}>{target.request}</span><span className="mt-1 flex items-center gap-1 text-xs font-normal">{target.selectedId ? <Check aria-hidden="true" className="size-3" /> : null}{targetStatus(target)}</span></span>
          </Button>)}
        </div>
      </nav>
      <section id="matching-active-detail" aria-labelledby="matching-active-heading" className="@container/matching-detail min-w-0 overflow-hidden rounded-lg border bg-card">
        <header className="border-b px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="matching-active-heading" className="flex items-center gap-2 text-sm font-semibold">{active.kind === 'customers' ? <Building2 aria-hidden="true" className="size-4 text-muted-foreground" /> : <Package aria-hidden="true" className="size-4 text-muted-foreground" />}{active.kind === 'customers' ? 'Kunden-Matching' : active.label}</h3>
            <div className="flex items-center gap-1">
              <span className="mr-2 text-xs text-muted-foreground tabular-nums">{activeIndex + 1} / {targets.length}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Vorherige Zuordnung" disabled={activeIndex === 0} onClick={() => onTargetChange(targets[activeIndex - 1].key)}><ChevronLeft aria-hidden="true" /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Nächste Zuordnung" disabled={activeIndex === targets.length - 1} onClick={() => onTargetChange(targets[activeIndex + 1].key)}><ChevronRight aria-hidden="true" /></Button>
            </div>
          </div>
        </header>
        <div className="grid min-w-0 items-start gap-5 p-4 @min-[44rem]/matching-detail:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section aria-labelledby="matching-master-data-heading" className="min-w-0">
            <h4 id="matching-master-data-heading" className="flex items-center gap-2 text-sm font-semibold"><Database aria-hidden="true" className="size-4 text-muted-foreground" />Aus den Stammdaten</h4>
            <p className="mt-1 mb-4 text-xs leading-5 text-muted-foreground">{active.kind === 'customers' ? 'Passenden Kunden auswählen.' : 'Passenden Artikel auswählen.'}</p>
            <MatchingCandidates key={active.key} kind={active.kind} result={active.result} selectedId={active.selectedId} selectedLabel={active.selectedLabel} disabled={disabled} outdated={!!job.data?.result && job.data.input_revision !== editor.revision}
              onSelect={(entity_id) => selection.mutate(active.kind === 'customers' ? { category: 'customer', entity_id } : { category: 'article', position_index: active.positionIndex!, entity_id })} />
          </section>
          <MatchingExtraction key={active.key} extraction={extraction} positionIndex={active.positionIndex} />
        </div>
      </section>
    </div>
  </div>
}
