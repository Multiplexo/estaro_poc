import { useState } from 'react'
import { useInquiryMatching } from '@/hooks/use-inquiry-matching'
import { InquiryMatchingPanel } from './inquiry-matching-panel'
import { ExtractionPanel } from './extraction-panel'
import { ReviewSaveBar } from './review-save-bar'
import { SourcePanel } from './source-panel'
import { useInquiryReview } from '@/hooks/use-inquiry-review'
import type { AnalysisResponse, ExtractionResult, InquiryResponse } from '@/lib/inquiry-models'

export function InquiryWorkspace({ inquiryId, analysis, inquiry }: {
  inquiry?: InquiryResponse; inquiryId: string; analysis: AnalysisResponse & { extraction: ExtractionResult }
}) {
  const review = useInquiryReview(inquiryId, analysis, inquiry)
  const [view, setView] = useState<'overview' | 'matching' | 'table'>('overview')
  const [matchingTarget, setMatchingTarget] = useState('customer')
  // The review page owns polling through useInquiryAnalysis.
  const matching = useInquiryMatching(inquiryId, analysis.job_id, review.editor.revision, { poll: false, runExclusive: review.persistence.runExclusive })
  const [sourceVisibility, setSourceVisibility] = useState({ overview: true, matching: false, table: false })
  const showPdf = sourceVisibility[view]
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className={`grid min-h-0 min-w-0 flex-1 gap-4 ${showPdf ? 'lg:grid-cols-2' : ''}`}>
      <ExtractionPanel editor={review.editor} view={view} onViewChange={setView} showPdf={showPdf} onTogglePdf={() => setSourceVisibility((visibility) => ({ ...visibility, [view]: !visibility[view] }))} matchingPanel={<InquiryMatchingPanel matching={matching} editor={review.editor} extraction={analysis.extraction} inquiry={inquiry} activeKey={matchingTarget} onTargetChange={setMatchingTarget} />} />
      {showPdf ? <SourcePanel inquiryId={inquiryId} sources={analysis.sources ?? []} highlights={review.source.highlights} navigation={review.source.navigation} /> : null}
    </div>
    <ReviewSaveBar review={{ ...review.persistence, saving: review.persistence.saving || matching.selection.isPending }} />
  </div>
}
