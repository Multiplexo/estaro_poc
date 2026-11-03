import { CircleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'

export function InquiryErrorIndicator({ message }: { message: string }) {
  return <Popover>
    <PopoverTrigger render={<Button variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label="Fehlerdetails anzeigen" />}>
      <CircleAlertIcon aria-hidden="true" />
    </PopoverTrigger>
    <span role="status" className="sr-only">Ein Fehler ist aufgetreten. Details über das Fehler-Icon anzeigen.</span>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-4">
      <PopoverTitle className="text-destructive">Fehlerdetails</PopoverTitle>
      <p className="max-h-56 overflow-y-auto text-sm whitespace-pre-wrap break-words">{message}</p>
    </PopoverContent>
  </Popover>
}
