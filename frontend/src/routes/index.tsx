import { createFileRoute } from '@tanstack/react-router'
import { InquiryList } from '@/components/inquiries/inquiry-list'

export const Route = createFileRoute('/')({ component: InquiriesPage })

function InquiriesPage() {
  return <InquiryList />
}
