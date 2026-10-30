import type { InquiryReview } from './inquiry-models'
import { customerIdentityKinds, isCustomerIdentityField, type AnalysisField, type Highlight } from './inquiry-analysis'
import {
  changedArticleAssignments,
  changeReviewAssignments,
  changeReviewField,
  confirmPositions,
  equalConfirmation,
  equalReviewField,
  positionFieldsChanged,
  positionKey,
  reapplyPositionConfirmations,
  reviewDraft,
  toggleReviewField,
  type ReviewDraft,
} from './inquiry-review'

export interface SourceSelection {
  documentId?: string
  highlightId?: string
  revision: number
}

export interface ReviewState {
  draft: ReviewDraft
  baseline: ReviewDraft
  latest: ReviewDraft
  stale: boolean
  customerTouched: boolean
  articlesTouched: string[]
  activeFieldId?: string
  selection: SourceSelection
  onlyOpen: boolean
}

export function createReviewState(saved?: InquiryReview): ReviewState {
  const draft = reviewDraft(saved)
  return { draft, baseline: draft, latest: draft, stale: false, customerTouched: false, articlesTouched: [], selection: { revision: 0 }, onlyOpen: false }
}

export function reviewIsDirty({ draft, baseline }: Pick<ReviewState, 'draft' | 'baseline'>): boolean {
  return draft.customer_id !== baseline.customer_id ||
    [...new Set([...Object.keys(draft.position_confirmations), ...Object.keys(baseline.position_confirmations)])].some((id) =>
      !equalConfirmation(draft.position_confirmations[id], baseline.position_confirmations[id])) ||
    [...new Set([...Object.keys(draft.article_ids), ...Object.keys(baseline.article_ids)])].some((id) => draft.article_ids[id] !== baseline.article_ids[id]) ||
    [...new Set([...Object.keys(draft.fields), ...Object.keys(baseline.fields)])].some((id) => !equalReviewField(draft.fields[id], baseline.fields[id]))
}

export function reviewHasConflict(state: ReviewState): boolean {
  return state.stale || state.latest.revision > state.baseline.revision
}

export type ReviewAction =
  | { type: 'receive'; review: InquiryReview }
  | { type: 'saved'; review: InquiryReview; submitted: ReviewDraft }
  | { type: 'stale' }
  | { type: 'reload' | 'reapply' }
  | { type: 'change'; entry: AnalysisField; value: string }
  | { type: 'confirm'; entry: AnalysisField }
  | { type: 'confirmGroup'; entries: AnalysisField[] }
  | { type: 'customer'; id: string | null }
  | { type: 'article'; fieldId: string; id?: string }
  | { type: 'assignments'; customerId: string; articleIds: Record<string, string> }
  | { type: 'filter'; onlyOpen: boolean }
  | { type: 'field'; entry: AnalysisField; highlights: Highlight[] }
  | { type: 'highlight'; highlight: Highlight }
  | { type: 'document'; id: string }

function selectHighlight(state: ReviewState, highlight?: Highlight): SourceSelection {
  return {
    documentId: highlight?.source.document_id ?? state.selection.documentId,
    highlightId: highlight?.id,
    revision: state.selection.revision + 1,
  }
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'receive': {
      const latest = reviewDraft(action.review)
      if (latest.revision <= state.latest.revision) return state
      return reviewIsDirty(state)
        ? { ...state, latest }
        : { ...state, draft: latest, baseline: latest, latest, stale: false, customerTouched: false, articlesTouched: [] }
    }
    case 'saved': {
      const saved = reviewDraft(action.review)
      if (saved.revision < state.baseline.revision) return state
      const latest = saved.revision >= state.latest.revision ? saved : state.latest
      const editedDuringSave = reviewIsDirty({ ...state, baseline: action.submitted })
      const position_confirmations = { ...state.draft.position_confirmations }
      for (const key of Object.keys(position_confirmations)) {
        if (equalConfirmation(position_confirmations[key], action.submitted.position_confirmations[key])) {
          if (saved.position_confirmations[key]) position_confirmations[key] = saved.position_confirmations[key]
          else delete position_confirmations[key]
        }
      }
      return editedDuringSave
        ? { ...state, baseline: saved, draft: { ...state.draft, position_confirmations, revision: saved.revision }, latest, stale: false,
          customerTouched: state.draft.customer_id !== action.submitted.customer_id || customerIdentityKinds.some((id) => !equalReviewField(state.draft.fields[id], action.submitted.fields[id])),
          articlesTouched: state.articlesTouched.filter((id) => state.draft.article_ids[id] !== action.submitted.article_ids[id] ||
            positionFieldsChanged(action.submitted, state.draft, id, false)) }
        : { ...state, baseline: latest, draft: latest, latest, stale: false, customerTouched: false, articlesTouched: [] }
    }
    case 'stale': return { ...state, stale: true }
    case 'reload': return state.latest.revision > state.baseline.revision
      ? { ...state, draft: state.latest, baseline: state.latest, stale: false, customerTouched: false, articlesTouched: [] } : state
    case 'reapply': {
      if (state.latest.revision <= state.baseline.revision) return state
      // Reapply only local changes; preserve unrelated edits from the newer revision.
      const fields = { ...state.latest.fields }
      for (const id of new Set([...Object.keys(state.draft.fields), ...Object.keys(state.baseline.fields)])) {
        if (!equalReviewField(state.draft.fields[id], state.baseline.fields[id])) {
          if (state.draft.fields[id]) fields[id] = state.draft.fields[id]
          else delete fields[id]
        }
      }
      const articleIds = { ...state.latest.article_ids }
      for (const id of state.articlesTouched) {
        if (state.draft.article_ids[id]) articleIds[id] = state.draft.article_ids[id]
        else delete articleIds[id]
      }
      const draft = {
        ...state.latest, fields,
        customer_id: state.customerTouched ? state.draft.customer_id : state.latest.customer_id,
        article_ids: articleIds,
      }
      return { ...state, baseline: state.latest, stale: false, draft: { ...draft, position_confirmations: reapplyPositionConfirmations(state.baseline, state.draft, state.latest, draft) } }
    }
    case 'change': {
      const draft = changeReviewField(state.draft, action.entry, action.value)
      if (draft === state.draft) return state
      const key = positionKey(action.entry.id)
      return { ...state, customerTouched: state.customerTouched || isCustomerIdentityField(action.entry.id),
      articlesTouched: key ? [...new Set([...state.articlesTouched, key])] : state.articlesTouched,
      draft }
    }
    case 'confirm': return { ...state, draft: toggleReviewField(state.draft, action.entry) }
    case 'confirmGroup': return { ...state, draft: confirmPositions(state.draft, action.entries) }
    case 'customer': return { ...state, customerTouched: true, draft: changeReviewAssignments(state.draft, action.id, state.draft.article_ids) }
    case 'article': {
      if (state.draft.article_ids[action.fieldId] === action.id) return state
      const articleIds = { ...state.draft.article_ids }
      if (action.id) articleIds[action.fieldId] = action.id
      else delete articleIds[action.fieldId]
      return { ...state, articlesTouched: [...new Set([...state.articlesTouched, action.fieldId])],
        draft: changeReviewAssignments(state.draft, state.draft.customer_id, articleIds) }
    }
    case 'assignments': {
      const draft = changeReviewAssignments(state.draft, action.customerId, action.articleIds)
      const changedKeys = changedArticleAssignments(state.draft, draft)
      return { ...state, customerTouched: state.customerTouched || state.draft.customer_id !== action.customerId,
      articlesTouched: [...new Set([...state.articlesTouched, ...changedKeys])],
      draft }
    }
    case 'filter': return { ...state, onlyOpen: action.onlyOpen }
    case 'document': return { ...state, activeFieldId: undefined, selection: { documentId: action.id, revision: state.selection.revision + 1 } }
    case 'highlight': return { ...state, onlyOpen: false, activeFieldId: action.highlight.fieldId, selection: selectHighlight(state, action.highlight) }
    case 'field': {
      const highlight = action.highlights.find((highlight) => highlight.fieldId === action.entry.id && highlight.id === state.selection.highlightId) ??
        action.highlights.find((highlight) => highlight.fieldId === action.entry.id)
      return { ...state, activeFieldId: action.entry.id, selection: selectHighlight(state, highlight) }
    }
  }
}
