import { LayoutGrid, Table2 } from 'lucide-react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

export function InquiryViewTabs() {
  return <TabsList aria-label="Ansicht der Anfrage" className="h-10!">
    <TabsTrigger value="overview" className="px-3"><LayoutGrid aria-hidden="true" />Übersicht</TabsTrigger>
    <TabsTrigger value="table" className="px-3"><Table2 aria-hidden="true" />Alle Anfragedaten</TabsTrigger>
  </TabsList>
}
