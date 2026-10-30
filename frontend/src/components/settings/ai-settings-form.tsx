import { useAiSettingsEditor, type AiSettingsEditor } from '@/hooks/use-ai-settings'
import type { SettingsResponse } from '@/lib/inquiry-models'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { SettingsField } from './settings-field'

export function AiSettingsForm({ settings }: { settings: SettingsResponse }) {
  const editor = useAiSettingsEditor(settings)
  return (
    <form className="space-y-6" onSubmit={event => { event.preventDefault(); editor.save() }}>
      <fieldset disabled={editor.isPending} className="min-w-0 space-y-6 disabled:opacity-70">
        <ProviderSettings editor={editor} />
      </fieldset>
      {editor.error ? <p role="alert" className="text-sm text-destructive">{editor.error}</p> : null}
      {editor.isSuccess ? <p role="status" className="text-sm text-emerald-700">Einstellungen gespeichert. Sie gelten ab dem nächsten Verarbeitungsschritt.</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!editor.isDirty || editor.isPending}>{editor.isPending ? 'Wird gespeichert …' : 'Einstellungen speichern'}</Button>
        <Button type="button" variant="outline" disabled={!editor.isDirty || editor.isPending} onClick={editor.reset}>Änderungen verwerfen</Button>
        {editor.isDirty ? <span className="text-xs text-muted-foreground">Ungespeicherte Änderungen</span> : null}
      </div>
    </form>
  )
}

function ProviderSettings({ editor }: { editor: AiSettingsEditor }) {
  const { values, change } = editor
  return (
    <Card>
      <CardHeader><CardTitle>API-Verbindung</CardTitle><CardDescription>Provider, Modell und Endpunkt für die KI-Verarbeitung.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="ai-provider" className="text-sm font-medium">Provider</label>
          <NativeSelect id="ai-provider" className="w-full" value={values.provider} onChange={event => editor.changeProvider(event.target.value as SettingsResponse['provider'])}>
            <NativeSelectOption value="ollama">Ollama</NativeSelectOption>
            <NativeSelectOption value="openai">OpenAI / OpenAI-kompatibel</NativeSelectOption>
          </NativeSelect>
        </div>
        <SettingsField label="API-Basis-URL" type="url" required value={values.base_url} onChange={event => change('base_url', event.target.value)} hint="Aus Sicht des Backends erreichbar. In Docker für lokale Dienste z. B. http://host.docker.internal:11434; bei OpenAI-kompatiblen APIs meist mit /v1." />
        <SettingsField label="Modellname" required value={values.model} onChange={event => change('model', event.target.value)} hint="Exakte Modell-ID des Providers. Das Modell muss dort verfügbar sein." />
        <SettingsField label="Zeitlimit pro API-Aufruf (Sekunden)" type="number" required min={0.1} step="any" value={values.timeout_seconds} onChange={event => change('timeout_seconds', event.target.valueAsNumber)} />
      </CardContent>
    </Card>
  )
}
