import { useId, useState, type SubmitEvent } from 'react'
import { FileText, Link2, ListChecks, Save, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useSaveRule } from '@/hooks/use-rules'
import { ruleCategories, ruleSectionLabels, ruleSections, type Rule, type RuleCategory, type RuleSection, type RuleSource } from '@/lib/rules'

const processingAreas = [
  { value: 'extraction', icon: Sparkles },
  { value: 'matching', icon: Link2 },
] as const

export function RuleEditorDialog({ rule, source, onClose, onSaved }: {
  rule?: Rule; source?: RuleSource; onClose: () => void; onSaved?: () => void
}) {
  const id = useId()
  const [title, setTitle] = useState(rule?.title ?? '')
  const [instruction, setInstruction] = useState(rule?.instruction ?? '')
  const [category, setCategory] = useState<RuleCategory>(rule?.category ?? 'extraction')
  const [section, setSection] = useState<RuleSection | ''>(rule?.section ?? '')
  const [isActive, setIsActive] = useState(rule?.is_active ?? true)
  const mutation = useSaveRule()
  const annotation = rule?.source ?? source

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending || !title.trim() || !instruction.trim() || !section) return
    mutation.mutate({ input: { title: title.trim(), instruction: instruction.trim(), category, section, is_active: isActive }, ruleId: rule?.id, source }, {
      onSuccess: () => { onSaved?.(); onClose() },
    })
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose() }}>
    <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl" showCloseButton={!mutation.isPending}>
      <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 sm:px-5 sm:pr-14">
        <DialogTitle>{rule ? 'Regel bearbeiten' : 'Neue Regel'}</DialogTitle>
        <DialogDescription>Fachwissen festhalten und den passenden Bereich zuordnen.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
          <fieldset disabled={mutation.isPending} className="grid min-w-0 items-start gap-5 disabled:opacity-70 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-4">
              <div className="space-y-2"><label htmlFor={`${id}-title`} className="text-sm font-medium">Titel</label>
                <Input id={`${id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="z. B. Kundennummer aus dem Briefkopf" autoFocus />
              </div>
              <div className="space-y-2"><label htmlFor={`${id}-instruction`} className="text-sm font-medium">Regel / Anweisung</label>
                <Textarea id={`${id}-instruction`} value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={4000} required rows={12} placeholder="Wenn …, dann …" aria-describedby={`${id}-instruction-help`} className="min-h-64 resize-y leading-relaxed md:min-h-80" />
                <div id={`${id}-instruction-help`} className="flex items-start justify-between gap-4 text-xs text-muted-foreground"><p>Beschreiben Sie die Bedingung und das gewünschte Ergebnis möglichst konkret.</p><span className="shrink-0 tabular-nums">{instruction.length} / 4.000</span></div>
              </div>
              {annotation ? <figure className="space-y-2 rounded-lg border bg-muted/25 p-3">
                <figcaption className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground"><span className="flex items-center gap-2"><FileText aria-hidden="true" className="size-3.5" />Markierte Textstelle</span><span className="shrink-0">Seite {annotation.page}</span></figcaption>
                <blockquote className="max-h-32 overflow-auto border-l-2 border-ring/50 pl-3 text-sm leading-relaxed whitespace-pre-wrap break-words">{annotation.quote}</blockquote>
              </figure> : null}
            </div>
            <aside className="min-w-0" aria-label="Zuordnung und Status">
              <Card size="sm" className="gap-0 py-0">
                <CardHeader className="border-b bg-muted/20 py-3">
                  <CardTitle className="flex items-center gap-2"><ListChecks aria-hidden="true" className="size-4 text-muted-foreground" /><h2>Zuordnung & Status</h2></CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 py-4">
                  <fieldset className="min-w-0 space-y-2">
                    <legend className="mb-2 text-sm font-medium">Bereich</legend>
                    <div className="flex rounded-lg bg-muted p-1">
                      {processingAreas.map(({ value, icon: Icon }) => <label key={value} className="min-w-0 flex-1 cursor-pointer">
                        <input className="peer sr-only" type="radio" name={`${id}-area`} value={value} checked={category === value} onChange={() => { setCategory(value); setSection('') }} />
                        <span className="flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring"><Icon aria-hidden="true" className="size-3.5" />{ruleCategories[value]}</span>
                      </label>)}
                    </div>
                  </fieldset>
                  <div className="space-y-2"><label htmlFor={`${id}-section`} className="text-sm font-medium">Kategorie</label>
                    <NativeSelect id={`${id}-section`} value={section} onChange={(event) => setSection(event.target.value as RuleSection)} className="w-full" required aria-describedby={`${id}-section-help`}>
                      <NativeSelectOption value="" disabled>Kategorie wählen …</NativeSelectOption>
                      {ruleSections[category].map((value) => <NativeSelectOption key={value} value={value}>{ruleSectionLabels[value]}</NativeSelectOption>)}
                    </NativeSelect>
                    <p id={`${id}-section-help`} className="text-xs leading-relaxed text-muted-foreground">Für welche Angaben soll die Regel gelten?</p>
                  </div>
                  <div className="border-t pt-4">
                    <label htmlFor={`${id}-active`} className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium"><span>Regel aktiv</span><input id={`${id}-active`} type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-primary" aria-describedby={`${id}-active-help`} /></label>
                    <p id={`${id}-active-help`} className="mt-2 text-xs leading-relaxed text-muted-foreground">{isActive ? 'Wird bei künftigen Durchläufen berücksichtigt.' : 'Bleibt gespeichert und wird vorerst nicht angewendet.'}</p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </fieldset>
          {mutation.error ? <p role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{mutation.error.message}</p> : null}
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 px-4 py-3 sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-muted-foreground">Änderungen gelten für künftige Durchläufe.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={mutation.isPending || !title.trim() || !instruction.trim() || !section}><Save aria-hidden="true" />{mutation.isPending ? 'Wird gespeichert …' : 'Regel speichern'}</Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
