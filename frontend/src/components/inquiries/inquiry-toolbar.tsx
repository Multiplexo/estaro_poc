import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { DeleteInquiryController } from '@/hooks/use-delete-inquiry'
import type { InboxSort, InboxStatus, InquiryInboxController } from '@/hooks/use-inquiry-inbox'
import { InquiryQueue } from './inquiry-queue'
import { Upload } from './upload'

export function InquiryToolbar({ inbox, deletion }: { inbox: InquiryInboxController; deletion: DeleteInquiryController }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
    <div className="flex items-center gap-2"><Upload /><InquiryQueue deletion={deletion} /></div>
    <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
      <div className="relative min-w-40 flex-1 lg:w-64">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Anfragen suchen" placeholder="Anfragen suchen …" maxLength={200} value={inbox.search} onChange={(event) => inbox.setSearch(event.target.value)} className="h-9 pl-9" />
      </div>
      <NativeSelect aria-label="Nach Status filtern" value={inbox.status} onChange={(event) => inbox.setStatus(event.target.value as InboxStatus)}>
        <NativeSelectOption value="all">Alle Status</NativeSelectOption>
        <NativeSelectOption value="new">Neu</NativeSelectOption>
        <NativeSelectOption disabled value="in_review">In Prüfung</NativeSelectOption>
        <NativeSelectOption disabled value="reviewed">Geprüft</NativeSelectOption>
      </NativeSelect>
      <NativeSelect aria-label="Anfragen sortieren" value={inbox.sort} onChange={(event) => inbox.setSort(event.target.value as InboxSort)}>
        <NativeSelectOption value="newest">Zuletzt erstellt</NativeSelectOption>
        <NativeSelectOption value="oldest">Älteste zuerst</NativeSelectOption>
        <NativeSelectOption value="customer">Kunde A–Z</NativeSelectOption>
      </NativeSelect>
      <Button variant="outline" size="icon" className="size-9" aria-label="Anfragen aktualisieren" disabled={inbox.query.isFetching} onClick={() => void inbox.query.refetch()}><RefreshCw className={inbox.query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} /></Button>
    </div>
  </div>
}
