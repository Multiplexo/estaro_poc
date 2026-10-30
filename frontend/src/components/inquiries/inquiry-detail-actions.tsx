import { useNavigate } from '@tanstack/react-router'
import { useDeleteInquiry } from '@/hooks/use-delete-inquiry'
import type { Inquiry } from '@/lib/api'
import { DeleteInquiryDialog } from './delete-inquiry-dialog'
import { InquiryJobActions } from './inquiry-job-actions'

export function InquiryDetailActions({ inquiry }: { inquiry: Inquiry }) {
  const navigate = useNavigate()
  const deletion = useDeleteInquiry({ onDeleted: () => navigate({ to: '/' }) })

  return <>
    <InquiryJobActions inquiry={inquiry} deletion={deletion} />
    <DeleteInquiryDialog deletion={deletion} />
  </>
}
