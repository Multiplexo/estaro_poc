import { lazy, Suspense, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

// Keep the dialog dependencies out of the initial inbox download.
const UploadDialog = lazy(() =>
  import('./upload-dialog').then((module) => ({
    default: module.UploadDialog,
  })),
)

export function Upload() {
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
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Upload
      </Button>
      {state !== 'idle' ? (
        <Suspense fallback={<p role="status">Upload wird geladen …</p>}>
          <UploadDialog open={open} onOpenChange={setOpen} triggerRef={triggerRef} />
        </Suspense>
      ) : null}
    </>
  )
}
