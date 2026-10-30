import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpload } from '@/hooks/use-upload'

export function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const { formRef, submit, selectFile, isUploading, canSubmit, error } = useUpload(onSuccess)
  return <form ref={formRef} onSubmit={submit} className="space-y-4">
    <fieldset disabled={isUploading} className="space-y-2 rounded-lg border border-dashed p-4">
      <label htmlFor="upload-pdf" className="block text-sm font-medium">PDF-Dokument</label>
      <Input id="upload-pdf" type="file" accept=".pdf,application/pdf" aria-describedby="upload-help"
        className="h-auto min-w-0 py-2 file:mr-3 file:cursor-pointer"
        onChange={(event) => selectFile(event.target.files?.[0])} />
    </fieldset>
    <p id="upload-help" className="text-xs text-muted-foreground">Ein PDF pro Anfrage. Die Extraktion startet nach dem Upload.</p>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button type="submit" disabled={!canSubmit || isUploading}>{isUploading ? 'Dokument wird hochgeladen …' : 'Anfrage anlegen'}</Button>
  </form>
}
