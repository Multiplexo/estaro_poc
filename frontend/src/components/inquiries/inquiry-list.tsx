import { lazy, Suspense } from 'react'
import { List, Table2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useInquiryInbox } from '@/hooks/use-inquiry-inbox'
import { useDeleteInquiry } from '@/hooks/use-delete-inquiry'
import { InquiryCards } from './inquiry-cards'
import { InquiryTable } from './inquiry-table'
import { InquiryToolbar } from './inquiry-toolbar'
import { InquiryPagination } from './inquiry-pagination'

const DeleteInquiryDialog = lazy(() => import('./delete-inquiry-dialog').then((module) => ({ default: module.DeleteInquiryDialog })))

export function InquiryList() {
  const inbox = useInquiryInbox()
  const deletion = useDeleteInquiry()
  const { query } = inbox

  return <section aria-labelledby="inquiries-heading" className="space-y-5">
    <header className="space-y-2">
      <h1 id="inquiries-heading" className="text-2xl font-semibold tracking-tight">Alle Anfragen{query.data ? <span className="ml-2 text-base font-normal text-muted-foreground">({query.data.total})</span> : null}</h1>
      <p className="text-sm text-muted-foreground">Fertig verarbeitete Anfragen im Überblick.</p>
    </header>
    <InquiryToolbar inbox={inbox} deletion={deletion} />
    <Tabs value={inbox.view} onValueChange={(value) => inbox.setView(String(value))} className="gap-5">
      <TabsList aria-label="Ansicht der Anfragen" className="h-9!">
        <TabsTrigger value="list" className="px-3"><List />Liste</TabsTrigger>
        <TabsTrigger value="table" className="px-3"><Table2 />Tabelle</TabsTrigger>
      </TabsList>
      {query.isError ? <p role="alert" className="text-sm text-destructive">{query.error.message} Die Übersicht konnte nicht aktualisiert werden.</p> : null}
      {query.isPending ? <p role="status" className="py-10 text-sm text-muted-foreground">Anfragen werden geladen …</p> : null}
      {query.data?.items.length === 0 ? <div className="rounded-lg border border-dashed px-6 py-14 text-center">
        <p className="font-medium">{inbox.search || inbox.status !== 'all' ? 'Keine passenden Anfragen' : 'Noch keine fertig verarbeiteten Anfragen'}</p>
        <p className="mt-2 text-sm text-muted-foreground">{inbox.search || inbox.status !== 'all' ? 'Passe die Suche oder den Statusfilter an.' : 'Neue Uploads erscheinen zuerst unter „Verarbeitung“ und danach hier.'}</p>
      </div> : null}
      <TabsContent value="list" aria-busy={query.isFetching || inbox.waiting}>
        {query.data?.items.length ? <InquiryCards inquiries={query.data.items} deletion={deletion} disabled={query.isPlaceholderData || inbox.waiting} /> : null}
      </TabsContent>
      <TabsContent value="table" aria-busy={query.isFetching || inbox.waiting}>
        {query.data?.items.length ? <InquiryTable inquiries={query.data.items} deletion={deletion} inbox={inbox} /> : null}
      </TabsContent>
    </Tabs>
    <InquiryPagination page={inbox.page} total={query.data?.total} isPlaceholderData={query.isPlaceholderData || inbox.waiting} onPageChange={inbox.setPage} />
    {deletion.inquiry ? <Suspense fallback={<p role="status">Bestätigung wird geladen …</p>}><DeleteInquiryDialog deletion={deletion} /></Suspense> : null}
  </section>
}
