import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpload } from '@/hooks/use-upload'

export function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const { formRef, submit, selectFile, isUploading, canSubmit, error } = useUpload(onSuccess)
  return <form ref={formRef} onSubmit={submit} className="space-y-4">
    <fieldset disabled={isUploading} className="space-y-2 rounded-lg border border-dashed p-4">
      <label htmlFor="upload-document" className="block text-sm font-medium">{t('upload.fileLabel')}</label>
      <Input id="upload-document" type="file" accept=".pdf,.msg,.eml,application/pdf,application/vnd.ms-outlook,message/rfc822" aria-describedby="upload-help"
        className="h-auto min-w-0 py-2 file:mr-3 file:cursor-pointer"
        onChange={(event) => selectFile(event.target.files?.[0])} />
    </fieldset>
    <p id="upload-help" className="text-xs text-muted-foreground">{t('upload.fileHint')}</p>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button type="submit" disabled={!canSubmit || isUploading}>{isUploading ? t('upload.uploading') : t('upload.createInquiry')}</Button>
  </form>
}
