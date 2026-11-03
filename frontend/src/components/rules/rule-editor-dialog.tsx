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
    <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden bg-background p-0 sm:max-w-4xl" showCloseButton={!mutation.isPending}>
      <DialogHeader className="shrink-0 border-b bg-card px-5 py-5 pr-12 sm:px-7 sm:pr-14">
        <p className="page-eyebrow mb-0">Feedback & Wissen</p>
        <DialogTitle className="text-2xl leading-tight font-semibold tracking-tight">{rule ? 'Regel bearbeiten' : 'Neue Regel'}</DialogTitle>
        <DialogDescription className="max-w-2xl leading-relaxed">Halten Sie Ihr Fachwissen als Regel fest und legen Sie fest, für welchen Bereich sie gilt.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
          <fieldset disabled={mutation.isPending} className="grid min-w-0 gap-5 disabled:opacity-70 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-5">
              <Card className="gap-0 py-0">
                <CardHeader className="border-b bg-muted/20 py-4"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><FileText aria-hidden="true" className="size-4 text-muted-foreground" /><h2>Regelinhalt</h2></CardTitle></CardHeader>
                <CardContent className="space-y-5 py-5">
                  <div className="space-y-2"><label htmlFor={`${id}-title`} className="text-sm font-medium">Titel</label>
                    <Input id={`${id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="z. B. Kundennummer aus dem Briefkopf" autoFocus className="h-10" />
                  </div>
                  <div className="space-y-2"><label htmlFor={`${id}-instruction`} className="text-sm font-medium">Regel / Anweisung</label>
                    <Textarea id={`${id}-instruction`} value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={4000} required rows={9} placeholder="Wenn …, dann …" aria-describedby={`${id}-instruction-help`} className="min-h-52 resize-y bg-background/40 p-3 text-sm leading-relaxed" />
                    <div id={`${id}-instruction-help`} className="flex items-start justify-between gap-4 text-xs text-muted-foreground"><p>Beschreiben Sie die Bedingung und das gewünschte Ergebnis möglichst konkret.</p><span className="shrink-0 tabular-nums">{instruction.length} / 4.000</span></div>
                  </div>
                </CardContent>
              </Card>
              {annotation ? <figure className="overflow-hidden rounded-xl border bg-card">
                <figcaption className="flex items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3 text-sm font-semibold"><span className="flex items-center gap-2"><FileText aria-hidden="true" className="size-4 text-muted-foreground" />Markierte Textstelle</span><span className="text-xs font-normal text-muted-foreground">Seite {annotation.page}</span></figcaption>
                <blockquote className="m-5 max-h-40 overflow-auto border-l-2 border-ring/50 pl-4 text-sm leading-relaxed whitespace-pre-wrap break-words">{annotation.quote}</blockquote>
              </figure> : null}
            </div>
            <aside className="min-w-0 space-y-5" aria-label="Zuordnung und Status">
              <Card className="gap-0 py-0">
                <CardHeader className="border-b bg-muted/20 py-4"><CardTitle className="flex items-center gap-2 text-sm font-semibold"><ListChecks aria-hidden="true" className="size-4 text-muted-foreground" /><h2>Zuordnung</h2></CardTitle></CardHeader>
                <CardContent className="space-y-5 py-5">
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
                    <NativeSelect id={`${id}-section`} value={section} onChange={(event) => setSection(event.target.value as RuleSection)} className="w-full [&_select]:h-10" required aria-describedby={`${id}-section-help`}>
                      <NativeSelectOption value="" disabled>Kategorie wählen …</NativeSelectOption>
                      {ruleSections[category].map((value) => <NativeSelectOption key={value} value={value}>{ruleSectionLabels[value]}</NativeSelectOption>)}
                    </NativeSelect>
                    <p id={`${id}-section-help`} className="text-xs leading-relaxed text-muted-foreground">Für welche Angaben soll die Regel gelten?</p>
                  </div>
                </CardContent>
              </Card>
              <div className="rounded-xl border bg-card p-5">
                <label htmlFor={`${id}-active`} className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold"><span>Regel aktiv</span><input id={`${id}-active`} type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-primary" aria-describedby={`${id}-active-help`} /></label>
                <p id={`${id}-active-help`} className="mt-2 text-xs leading-relaxed text-muted-foreground">{isActive ? 'Wird bei künftigen Durchläufen berücksichtigt.' : 'Bleibt gespeichert und wird vorerst nicht angewendet.'}</p>
              </div>
            </aside>
          </fieldset>
          {mutation.error ? <p role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{mutation.error.message}</p> : null}
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 bg-card px-5 py-4 sm:items-center sm:justify-between sm:px-7">
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
