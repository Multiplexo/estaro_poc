import { useState } from 'react'
import { ExtractionPanel } from './extraction-panel'
import { ReviewSaveBar } from './review-save-bar'
import { SourcePanel } from './source-panel'
import { useInquiryReview } from '@/hooks/use-inquiry-review'
import type { AnalysisResponse, ExtractionResult, InquiryResponse } from '@/lib/inquiry-models'

export function InquiryWorkspace({ inquiryId, analysis, inquiry }: {
  inquiry?: InquiryResponse; inquiryId: string; analysis: AnalysisResponse & { extraction: ExtractionResult }
}) {
  const review = useInquiryReview(inquiryId, analysis, inquiry)
  const [view, setView] = useState<'overview' | 'table'>('overview')
  const [showTablePdf, setShowTablePdf] = useState(false)
  const showPdf = view === 'overview' || showTablePdf
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className={`grid min-h-0 min-w-0 flex-1 gap-4 ${showPdf ? 'lg:grid-cols-2' : ''}`}>
      <ExtractionPanel editor={review.editor} view={view} onViewChange={setView} showPdf={showTablePdf} onTogglePdf={() => setShowTablePdf((visible) => !visible)} />
      {showPdf ? <SourcePanel inquiryId={inquiryId} sources={analysis.sources ?? []} highlights={review.source.highlights} navigation={review.source.navigation} /> : null}
    </div>
    <ReviewSaveBar review={review.persistence} />
  </div>
}
