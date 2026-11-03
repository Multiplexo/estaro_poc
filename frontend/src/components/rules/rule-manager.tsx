import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select'
import { useDeleteRule, useRules, useSaveRule } from '@/hooks/use-rules'
import { ruleCategories, ruleSectionLabel, ruleSectionLabels, ruleSections, type Rule, type RuleCategory, type RuleSection } from '@/lib/rules'
import { RuleEditorDialog } from './rule-editor-dialog'

export function RuleManager() {
  const query = useRules()
  const update = useSaveRule()
  const deletion = useDeleteRule()
  const [editor, setEditor] = useState<Rule | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Rule | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<RuleCategory | 'all'>('all')
  const [section, setSection] = useState<RuleSection | 'all' | 'uncategorized'>('all')
  const [status, setStatus] = useState('all')
  const [notice, setNotice] = useState('')
  const rules = query.data ?? []
  const term = search.trim().toLocaleLowerCase('de')
  const visible = rules.filter((rule) => (category === 'all' || rule.category === category)
    && (section === 'all' || (section === 'uncategorized' ? !rule.section : rule.section === section))
    && (status === 'all' || rule.is_active === (status === 'active'))
    && (!term || `${rule.title} ${rule.instruction} ${ruleCategories[rule.category]} ${ruleSectionLabel(rule.section)} ${rule.source?.quote ?? ''}`.toLocaleLowerCase('de').includes(term)))

  return <section className="space-y-6">
    <header className="page-heading flex flex-wrap items-start justify-between gap-4"><div className="space-y-2">
      <p className="page-eyebrow">Feedback & Wissen</p>
      <h1 className="text-3xl font-semibold tracking-tight">Regeln</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">Steuern Sie die Extraktion und das Matching mit Ihrem Fachwissen. Aktive Regeln werden bei künftigen Durchläufen berücksichtigt.</p>
    </div><Button onClick={() => setEditor('new')}><Plus aria-hidden="true" />Neue Regel</Button></header>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
      <div className="relative min-w-48 flex-1"><Search aria-hidden="true" className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input aria-label="Regeln durchsuchen" placeholder="Regeln durchsuchen …" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
      </div>
      <NativeSelect aria-label="Nach Bereich filtern" value={category} onChange={(event) => { setCategory(event.target.value as RuleCategory | 'all'); setSection('all') }}>
        <NativeSelectOption value="all">Alle Bereiche</NativeSelectOption>
        {Object.entries(ruleCategories).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
      </NativeSelect>
      <NativeSelect aria-label="Nach Kategorie filtern" value={section} onChange={(event) => setSection(event.target.value as typeof section)}>
        <NativeSelectOption value="all">Alle Kategorien</NativeSelectOption>
        {(category === 'all' ? ['extraction', 'matching'] as const : [category]).map((area) => <NativeSelectOptGroup key={area} label={ruleCategories[area]}>
          {ruleSections[area].map((value) => <NativeSelectOption key={value} value={value}>{ruleSectionLabels[value]}</NativeSelectOption>)}
        </NativeSelectOptGroup>)}
        <NativeSelectOption value="uncategorized">Nicht kategorisiert</NativeSelectOption>
      </NativeSelect>
      <NativeSelect aria-label="Nach Status filtern" value={status} onChange={(event) => setStatus(event.target.value)}>
        <NativeSelectOption value="all">Alle Status</NativeSelectOption><NativeSelectOption value="active">Aktiv</NativeSelectOption><NativeSelectOption value="inactive">Inaktiv</NativeSelectOption>
      </NativeSelect>
    </div>
    {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
    {query.isPending ? <p role="status">Regeln werden geladen …</p> : null}
    {query.isError ? <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{query.error.message}<Button variant="outline" onClick={() => void query.refetch()}>Erneut versuchen</Button></div> : null}
    {update.error ? <p role="alert" className="text-sm text-destructive">{update.error.message}</p> : null}
    {query.isSuccess ? <>
      <p className="text-sm text-muted-foreground">{visible.length} von {rules.length} Regeln · {rules.filter((rule) => rule.is_active).length} aktiv</p>
      {visible.length ? <div className="grid gap-4 xl:grid-cols-2">{visible.map((rule) => <article key={rule.id} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5"><span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{ruleCategories[rule.category]}</span><span className="inline-flex rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{ruleSectionLabel(rule.section)}</span></div>
          <h2 className="break-words text-base font-semibold">{rule.title}</h2>
        </div><label className="flex shrink-0 items-center gap-2 text-xs"><input type="checkbox" aria-label={`Regel „${rule.title}“ aktivieren`} checked={rule.is_active} disabled={update.isPending}
          onChange={(event) => update.mutate({ ruleId: rule.id, input: { title: rule.title, instruction: rule.instruction, category: rule.category, section: rule.section, is_active: event.target.checked } }, { onSuccess: () => setNotice('Regelstatus gespeichert.') })}
          className="size-4 accent-primary" />{rule.is_active ? 'Aktiv' : 'Inaktiv'}</label></div>
        <p className="whitespace-pre-wrap break-words text-sm">{rule.instruction}</p>
        {rule.source ? <figure className="rounded-lg border-l-2 border-amber-400 bg-amber-50/60 p-3 text-sm">
          <figcaption className="mb-1 text-xs text-muted-foreground">PDF-Markierung · Seite {rule.source.page}</figcaption>
          <blockquote className="max-h-28 overflow-auto whitespace-pre-wrap break-words">{rule.source.quote}</blockquote>
          {rule.source.inquiry_id && rule.source.document_id ? <Link to="/anfragen/$inquiryId" params={{ inquiryId: rule.source.inquiry_id }} className="mt-2 inline-block text-xs font-medium underline underline-offset-4">Zur Anfrage</Link> : <p className="mt-2 text-xs text-muted-foreground">Quelldokument wurde gelöscht.</p>}
        </figure> : null}
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">Geändert am {new Date(rule.updated_at).toLocaleDateString('de-DE')}</p>
          <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditor(rule)}><Pencil aria-hidden="true" />Bearbeiten</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { deletion.reset(); setDeleting(rule) }}><Trash2 aria-hidden="true" />Löschen</Button></div>
        </footer>
      </article>)}</div> : <div className="rounded-xl border border-dashed p-10 text-center"><h2 className="font-medium">{rules.length ? 'Keine passenden Regeln' : 'Noch keine Regeln vorhanden'}</h2><p className="mt-2 text-sm text-muted-foreground">{rules.length ? 'Passen Sie Suche oder Filter an.' : 'Erstellen Sie Ihre erste Regel hier oder markieren Sie eine Textstelle in einer PDF-Anfrage.'}</p></div>}
    </> : null}
    {editor ? <RuleEditorDialog key={editor === 'new' ? 'new' : editor.id} rule={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => setNotice('Regel gespeichert. Aktive Regeln gelten für künftige Durchläufe.')} /> : null}
    <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !deletion.isPending) setDeleting(null) }}>
      <DialogContent showCloseButton={!deletion.isPending}><DialogHeader><DialogTitle>Regel löschen?</DialogTitle><DialogDescription>„{deleting?.title}“ wird mit ihrer PDF-Markierung gelöscht und künftig nicht mehr berücksichtigt.</DialogDescription></DialogHeader>
        {deletion.error ? <p role="alert" className="text-sm text-destructive">{deletion.error.message}</p> : null}
        <DialogFooter><Button variant="outline" disabled={deletion.isPending} onClick={() => setDeleting(null)}>Abbrechen</Button>
          <Button variant="destructive" disabled={deletion.isPending} onClick={() => { if (deleting) deletion.mutate(deleting.id, { onSuccess: () => { setDeleting(null); setNotice('Regel gelöscht.') } }) }}>{deletion.isPending ? 'Wird gelöscht …' : 'Regel löschen'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
