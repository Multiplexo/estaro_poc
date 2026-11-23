import i18n, { useTranslation } from '@/i18n'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useIsAdmin } from '@/hooks/use-current-user'
import { useDeleteRule, useRules, useSaveRule } from '@/hooks/use-rules'
import { ruleCategoryKeys, ruleSectionLabel, type Rule, type RuleCategory } from '@/lib/rules'
import { RuleEditorDialog } from './rule-editor-dialog'
import { RuleNavigation, type RuleNavigationSection } from './rule-navigation'

export function RuleManager() {
  const { t } = useTranslation()
  const query = useRules()
  const update = useSaveRule()
  const deletion = useDeleteRule()
  const isAdmin = useIsAdmin()
  const [editor, setEditor] = useState<Rule | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Rule | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<RuleCategory | 'all'>('all')
  const [section, setSection] = useState<RuleNavigationSection>('all')
  const [status, setStatus] = useState('all')
  const [notice, setNotice] = useState('')
  const rules = query.data ?? []
  const term = search.trim().toLocaleLowerCase(i18n.language)
  const filtered = rules.filter((rule) => (status === 'all' || rule.is_active === (status === 'active'))
    && (!term || `${rule.title} ${rule.instruction} ${t(ruleCategoryKeys[rule.category])} ${ruleSectionLabel(rule.section)} ${rule.source?.quote ?? ''}`.toLocaleLowerCase(i18n.language).includes(term)))
  const visible = filtered.filter((rule) => (category === 'all' || rule.category === category)
    && (section === 'all' || (section === 'uncategorized' ? !rule.section : rule.section === section)))
  const selectionLabel = section === 'all' ? (category === 'all' ? t('rules.all') : t(ruleCategoryKeys[category]))
    : section === 'uncategorized' ? t('rules.uncategorized') : ruleSectionLabel(section)

  return <section className="space-y-6">
    <header className="page-heading flex flex-wrap items-start justify-between gap-4"><div className="space-y-2">
      <p className="page-eyebrow">{t('rules.eyebrow')}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t('navigation.rules')}</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{t('rules.description')}</p>
    </div><Button onClick={() => setEditor('new')}><Plus aria-hidden="true" />{t('rules.create')}</Button></header>
    <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
    <RuleNavigation category={category} section={section} onSelect={(area, value) => { setCategory(area); setSection(value) }} />
    <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
      <div className="relative min-w-48 flex-1"><Search aria-hidden="true" className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input aria-label={t('rules.searchLabel')} placeholder={t('rules.searchPlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
      </div>
      <NativeSelect aria-label={t('common.filterByStatus')} value={status} onChange={(event) => setStatus(event.target.value)}>
        <NativeSelectOption value="all">{t('common.allStatuses')}</NativeSelectOption><NativeSelectOption value="active">{t('common.active')}</NativeSelectOption><NativeSelectOption value="inactive">{t('common.inactive')}</NativeSelectOption>
      </NativeSelect>
    </div>
    {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
    {query.isPending ? <p role="status">{t('rules.loading')}</p> : null}
    {query.isError ? <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{query.error.message}<Button variant="outline" onClick={() => void query.refetch()}>{t('navigation.retry')}</Button></div> : null}
    {update.error ? <p role="alert" className="text-sm text-destructive">{update.error.message}</p> : null}
    {query.isSuccess ? <>
      <div className="space-y-1"><h2 className="text-lg font-semibold">{selectionLabel}</h2><p className="text-sm text-muted-foreground">{t('rules.summary', { count: visible.length, total: rules.length, active: rules.filter((rule) => rule.is_active).length })}</p></div>
      {visible.length ? <div className="grid gap-4 2xl:grid-cols-2">{visible.map((rule) => <article key={rule.id} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5"><span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{t(ruleCategoryKeys[rule.category])}</span><span className="inline-flex rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{ruleSectionLabel(rule.section)}</span></div>
          <h2 className="break-words text-base font-semibold">{rule.title}</h2>
        </div><label className="flex shrink-0 items-center gap-2 text-xs"><input type="checkbox" aria-label={`Regel „${rule.title}“ aktivieren`} checked={rule.is_active} disabled={update.isPending}
          onChange={(event) => update.mutate({ ruleId: rule.id, input: { title: rule.title, instruction: rule.instruction, category: rule.category, section: rule.section, is_active: event.target.checked } }, { onSuccess: () => setNotice(t('rules.statusSaved')) })}
          className="size-4 accent-primary" />{rule.is_active ? t('common.active') : t('common.inactive')}</label></div>
        <p className="whitespace-pre-wrap break-words text-sm">{rule.instruction}</p>
        {rule.source ? <figure className="rounded-lg border-l-2 border-amber-400 bg-amber-50/60 p-3 text-sm">
          <figcaption className="mb-1 text-xs text-muted-foreground">{t('rules.annotationPage', { page: rule.source.page })}</figcaption>
          <blockquote className="max-h-28 overflow-auto whitespace-pre-wrap break-words">{rule.source.quote}</blockquote>
          {rule.source.inquiry_id && rule.source.document_id ? <Link to="/anfragen/$inquiryId" params={{ inquiryId: rule.source.inquiry_id }} className="mt-2 inline-block text-xs font-medium underline underline-offset-4">{t('rules.goToInquiry')}</Link> : <p className="mt-2 text-xs text-muted-foreground">{t('rules.sourceDeleted')}</p>}
        </figure> : null}
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">{t('rules.updatedAt', { date: new Intl.DateTimeFormat(i18n.language).format(new Date(rule.updated_at)) })}</p>
          <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditor(rule)}><Pencil aria-hidden="true" />{t('common.edit')}</Button>
            {isAdmin ? <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { deletion.reset(); setDeleting(rule) }}><Trash2 aria-hidden="true" />{t('common.delete')}</Button> : null}</div>
        </footer>
      </article>)}</div> : <div className="rounded-xl border border-dashed p-10 text-center"><h2 className="font-medium">{rules.length ? t('rules.noResults') : t('rules.empty')}</h2><p className="mt-2 text-sm text-muted-foreground">{rules.length ? t('rules.adjustFilters') : t('rules.emptyHint')}</p></div>}
    </> : null}
    </div>
    </div>
    {editor ? <RuleEditorDialog key={editor === 'new' ? 'new' : editor.id} rule={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => setNotice(t('rules.saved'))} /> : null}
    <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !deletion.isPending) setDeleting(null) }}>
      <DialogContent showCloseButton={!deletion.isPending}><DialogHeader><DialogTitle>{t('rules.deleteTitle')}</DialogTitle><DialogDescription>{t('rules.deleteDescription', { title: deleting?.title })}</DialogDescription></DialogHeader>
        {deletion.error ? <p role="alert" className="text-sm text-destructive">{deletion.error.message}</p> : null}
        <DialogFooter><Button variant="outline" disabled={deletion.isPending} onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={deletion.isPending} onClick={() => { if (deleting) deletion.mutate(deleting.id, { onSuccess: () => { setDeleting(null); setNotice(t('rules.deleted')) } }) }}>{deletion.isPending ? t('common.deleting') : t('rules.deleteConfirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
