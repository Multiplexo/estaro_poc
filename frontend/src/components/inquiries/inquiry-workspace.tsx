import { ExtractionPanel } from './extraction-panel'
import { ReviewSaveBar } from './review-save-bar'
import { SourcePanel } from './source-panel'
import { useInquiryReview } from '@/hooks/use-inquiry-review'
import type { AnalysisResponse, ExtractionResult } from '@/lib/inquiry-models'

export function InquiryWorkspace({ inquiryId, analysis }: {
  inquiryId: string; analysis: AnalysisResponse & { extraction: ExtractionResult }
}) {
  const review = useInquiryReview(inquiryId, analysis)
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-2">
      <ExtractionPanel editor={review.editor} />
      <SourcePanel inquiryId={inquiryId} sources={analysis.sources ?? []} highlights={review.source.highlights} navigation={review.source.navigation} />
    </div>
    <ReviewSaveBar review={review.persistence} />
  </div>
}
