import { useTranslation } from '@/i18n'
import { useId, useState, type SubmitEvent } from 'react'
import { useLocation } from '@tanstack/react-router'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { inquiryIdFromPath, useSendFeedback, type FeedbackKind } from '@/hooks/use-feedback'

const kinds: FeedbackKind[] = ['domain', 'change', 'bug']

export function FeedbackDialog() {
  const { t } = useTranslation()
  const id = useId()
  const location = useLocation()
  const send = useSendFeedback()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>('domain')
  const [message, setMessage] = useState('')

  function close(next: boolean) {
    if (send.isPending) return
    setOpen(next)
    if (!next) { setMessage(''); setKind('domain'); send.reset() }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    send.mutate({
      kind,
      message: message.trim(),
      page: location.pathname,
      inquiry_id: inquiryIdFromPath(location.pathname),
    })
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring">
      <MessageSquarePlus aria-hidden="true" className="size-4" />{t('feedback.open')}
    </button>
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!send.isPending}>
        <DialogHeader>
          <DialogTitle>{t('feedback.title')}</DialogTitle>
          <DialogDescription>{t('feedback.description')}</DialogDescription>
        </DialogHeader>
        {send.isSuccess ? <>
          <p role="status" className="text-sm text-emerald-700">{t('feedback.thanks')}</p>
          <DialogFooter><Button onClick={() => close(false)}>{t('common.close')}</Button></DialogFooter>
        </> : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={send.isPending} className="space-y-4 disabled:opacity-70">
              <div className="space-y-2">
                <label htmlFor={`${id}-kind`} className="text-sm font-medium">{t('feedback.kind')}</label>
                <NativeSelect id={`${id}-kind`} value={kind} onChange={(event) => setKind(event.target.value as FeedbackKind)} className="w-full">
                  {kinds.map((value) => <NativeSelectOption key={value} value={value}>{t(`feedback.kinds.${value}`)}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <label htmlFor={`${id}-message`} className="text-sm font-medium">{t('feedback.message')}</label>
                <Textarea id={`${id}-message`} value={message} onChange={(event) => setMessage(event.target.value)} minLength={3} maxLength={4000} required rows={6} placeholder={t(`feedback.placeholders.${kind}`)} autoFocus />
              </div>
              {inquiryIdFromPath(location.pathname) ? <p className="text-xs text-muted-foreground">{t('feedback.inquiryContext')}</p> : null}
            </fieldset>
            {send.error ? <p role="alert" className="text-sm text-destructive">{send.error.message}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={send.isPending} onClick={() => close(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={send.isPending || message.trim().length < 3}>{send.isPending ? t('feedback.sending') : t('feedback.send')}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  </>
}
