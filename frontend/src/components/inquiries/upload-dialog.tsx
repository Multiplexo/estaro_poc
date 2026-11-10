import { useTranslation } from '@/i18n'
import type { RefObject } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UploadForm } from './upload-form'

type UploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

export function UploadDialog({ open, onOpenChange, triggerRef }: UploadDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent keepMounted finalFocus={triggerRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('upload.title')}</DialogTitle>
          <DialogDescription>
            {t('upload.description')}
          </DialogDescription>
        </DialogHeader>
        <UploadForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
