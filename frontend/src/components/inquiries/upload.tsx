import { useTranslation } from '@/i18n'
import { lazy, Suspense, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Keep the dialog dependencies out of the initial inbox download.
const UploadDialog = lazy(() =>
  import('./upload-dialog').then((module) => ({
    default: module.UploadDialog,
  })),
)

export function Upload() {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'open' | 'closed'>('idle')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const open = state === 'open'

  function setOpen(open: boolean) {
    setState(open ? 'open' : 'closed')
  }

  return (
    <>
      <Button
        ref={triggerRef}
        className="h-10 gap-2 px-4 shadow-xs"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" className="size-4" />{t('upload.action')}
      </Button>
      {state !== 'idle' ? (
        <Suspense fallback={null}>
          <UploadDialog open={open} onOpenChange={setOpen} triggerRef={triggerRef} />
        </Suspense>
      ) : null}
    </>
  )
}
