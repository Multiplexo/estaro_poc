import { ChevronDown, Inbox } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { useInquiryQueue } from '@/hooks/use-inquiry-queue'
import { PAGE_SIZE } from '@/hooks/use-inquiries'
import type { DeleteInquiryController } from '@/hooks/use-delete-inquiry'
import { InquiryPagination } from './inquiry-pagination'
import { JobStatus } from './job-status'
import { InquiryJobActions } from './inquiry-job-actions'

export function InquiryQueue({ deletion }: { deletion: DeleteInquiryController }) {
  const queue = useInquiryQueue()
  return <Popover>
    <PopoverTrigger render={<Button variant="outline" className="h-9" />}>
      <Inbox />Verarbeitung<Badge variant="secondary">{queue.data?.total ?? '…'}</Badge><ChevronDown />
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
      <PopoverHeader className="border-b px-4 py-3">
        <PopoverTitle>Verarbeitungsqueue</PopoverTitle>
        <PopoverDescription>In diesem Browser gestartete Extraktionen.</PopoverDescription>
      </PopoverHeader>
      <div className="max-h-[min(32rem,65svh)] overflow-y-auto px-4">
        {queue.isPending ? <p role="status" className="py-5 text-muted-foreground">Queue wird geladen …</p> : null}
        {queue.isError ? <div role="alert" className="space-y-2 py-4"><p className="text-destructive">{queue.error.message}</p><Button variant="outline" disabled={queue.isFetching} onClick={() => void queue.refetch()}>Erneut versuchen</Button></div> : null}
        {queue.data?.total === 0 ? <p className="py-6 text-center text-muted-foreground">Alle Anfragen sind verarbeitet.</p> : null}
        <ul className="divide-y">{queue.data?.items.map((inquiry) => <li key={inquiry.id} className="space-y-3 py-4">
          <p className="truncate font-medium" title={inquiry.documents[0]?.filename}>{inquiry.documents[0]?.filename || `Anfrage ${inquiry.id.slice(0, 8)}`}</p>
          <JobStatus job={inquiry.processing_job} />
          {inquiry.processing_job?.status === 'completed' ? <Link to="/anfragen/$inquiryId" params={{ inquiryId: inquiry.id }} className="block text-xs underline underline-offset-4">Anfrage und Quellen ansehen</Link> : null}
          <InquiryJobActions inquiry={inquiry} deletion={deletion} disabled={queue.isPlaceholderData} />
        </li>)}</ul>
      </div>
      {queue.data && queue.data.total > PAGE_SIZE ? <div className="border-t p-3"><InquiryPagination page={queue.page} total={queue.data.total} onPageChange={queue.setPage} isPlaceholderData={queue.isPlaceholderData} /></div> : null}
    </PopoverContent>
  </Popover>
}
