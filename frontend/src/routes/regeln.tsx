import { createFileRoute } from '@tanstack/react-router'
import { RuleManager } from '@/components/rules/rule-manager'

export const Route = createFileRoute('/regeln')({
  validateSearch: (search: Record<string, unknown>): { returnInquiryId?: string } => ({
    returnInquiryId: typeof search.returnInquiryId === 'string' && search.returnInquiryId.trim() ? search.returnInquiryId : undefined,
  }),
  component: RuleManager,
})
