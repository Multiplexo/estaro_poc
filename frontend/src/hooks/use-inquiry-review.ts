import { unavailable } from '@/lib/api-capabilities'
import { useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sourceSelection, type SourceNavigation } from './use-source-navigation'
import { ApiError } from '@/lib/api'
import type { AnalysisResponse, InquiryReview } from '@/lib/inquiry-models'
import { analysisFields, fieldHighlights, type AnalysisField, type Highlight } from '@/lib/inquiry-analysis'
import { confirmPositions, reviewedField, reviewFieldGroups, reviewSection, type ReviewDraft } from '@/lib/inquiry-review'
import { createInquiryEvaluation } from '@/lib/inquiry-evaluation'
import { inquiryTrafficLight } from '@/lib/inquiry-traffic-light'
import { createReviewState, reviewHasConflict, reviewIsDirty, reviewReducer } from '@/lib/inquiry-review-state'
import { scrollBehavior } from '@/lib/motion'
import { useTranslation } from '@/i18n'

function focusField(id: string) {
  requestAnimationFrame(() => {
    const input = document.getElementById(`review-${id}`)
    input?.scrollIntoView({ block: 'center', behavior: scrollBehavior() })
    input?.focus({ preventScroll: true })
  })
}

export function useInquiryReview(inquiryId: string, analysis: AnalysisResponse) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fields = useMemo(() => analysis.extraction ? analysisFields(analysis.extraction) : [], [analysis.extraction])
  const evaluation = useMemo(() => analysis.extraction ? createInquiryEvaluation(analysis.extraction, fields) : undefined, [analysis.extraction, fields])
  const groups = useMemo(() => reviewFieldGroups(fields), [fields])
  const articleFields = useMemo(() => groups.positions.flatMap((position) => position.fields), [groups.positions])
  const highlights = useMemo(() => fieldHighlights(fields), [fields])
  const [state, dispatch] = useReducer(reviewReducer, analysis.review, createReviewState)
  // Reconcile during rendering so every view sees the same revision immediately.
  if ((analysis.review?.revision ?? 0) > state.latest.revision) dispatch({ type: 'receive', review: analysis.review! })
  const { draft, baseline } = state
  const dirty = useMemo(() => reviewIsDirty({ draft, baseline }), [draft, baseline])
  const conflict = reviewHasConflict(state)
  const positionStatuses = useMemo(() => analysis.extraction?.items.map((_, index) => evaluation!.positionStatus(draft, index)) ?? [], [analysis.extraction, draft, evaluation])
  const positions = useMemo(() => groups.positions.map((position) => {
    const value = (kind: AnalysisField['kind']) => reviewedField(position.fields.find((entry) => entry.kind === kind)!, draft).value
    const status = positionStatuses[position.index]
    return {
      ...position, article: value('article'), quantity: value('quantity'), unit: value('unit'), status,
      confirmed: status.origin === 'manual' && position.fields.every((entry) => reviewedField(entry, draft).confirmed),
      selectedId: draft.article_ids[position.key],
      suggestions: evaluation!.suggestions(draft, position.key),
    }
  }), [groups.positions, positionStatuses, draft, evaluation])
  const customerSuggestions = useMemo(() => evaluation?.suggestions(draft, 'customer') ?? [], [evaluation, draft])
  const openFields = useMemo(() => fields.filter((entry) => !reviewedField(entry, draft).confirmed), [fields, draft])
  const defaultValues = useMemo(() => new Map(fields.map((entry) => [entry.id, { value: entry.field.value ?? '', confirmed: false }])), [fields])
  const highlightsByField = useMemo(() => {
    const grouped = new Map<string, Highlight[]>()
    for (const entry of fields) grouped.set(entry.id, [])
    for (const highlight of highlights) grouped.get(highlight.fieldId)!.push(highlight)
    return grouped
  }, [fields, highlights])
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['inquiry-analysis', inquiryId] })
  const mutation = useMutation({
    mutationFn: async (_submitted: ReviewDraft) => await unavailable<InquiryReview>(),
    onSuccess: (review, submitted) => {
      void queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      dispatch({ type: 'saved', review, submitted })
      queryClient.setQueriesData<AnalysisResponse>({ queryKey: ['inquiry-analysis', inquiryId] }, (data) =>
        data && (data.review?.revision ?? 0) <= (review.revision ?? 0) ? { ...data, review } : data)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        dispatch({ type: 'stale' })
        void refresh()
      }
    },
  })
  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm(t('review.leaveUnsaved')),
    enableBeforeUnload: dirty,
  })
  const { mutate, isPending } = mutation
  const savePending = useRef(false)
  const submit = useCallback((submitted: ReviewDraft) => {
    if (conflict || isPending || savePending.current) return
    savePending.current = true
    mutate(submitted, { onSettled: () => { savePending.current = false } })
  }, [conflict, isPending, mutate])
  const save = useCallback(() => {
    if (dirty) submit(state.draft)
  }, [dirty, submit, state.draft])
  const assignmentsComplete = !!draft.customer_id && positions.length > 0 && positions.every((position) => !!position.selectedId)
  const complete = () => {
    if (!assignmentsComplete || conflict || isPending || savePending.current) return
    const submitted = confirmPositions(state.draft, fields)
    dispatch({ type: 'confirmGroup', entries: fields })
    submit(submitted)
  }
  const saveFromKeyboard = useEffectEvent(save)
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveFromKeyboard()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const selectField = useCallback((entry: AnalysisField) => dispatch({ type: 'field', entry, highlights }), [highlights])
  const selectHighlight = useCallback((highlight: Highlight) => {
    dispatch({ type: 'highlight', highlight })
    focusField(highlight.fieldId)
  }, [])
  const selectDocument = useCallback((id: string) => dispatch({ type: 'document', id }), [])
  const navigation: SourceNavigation = useMemo(() => ({
    ...sourceSelection(analysis.sources ?? [], highlights, state.selection),
    selectDocument,
    selectHighlight,
  }), [analysis.sources, highlights, state.selection, selectDocument, selectHighlight])
  const fieldHandlers = useMemo(() => new Map(fields.map((entry) => [entry.id, {
    onChange: (value: string) => dispatch({ type: 'change', entry, value }),
    onFocus: () => selectField(entry),
    onConfirm: () => dispatch({ type: 'confirm', entry }),
    onReset: () => dispatch({ type: 'change', entry, value: entry.field.value ?? '' }),
  }])), [fields, selectField])
  const resolveConflict = (type: 'reload' | 'reapply') => {
    if (state.latest.revision <= state.baseline.revision) return
    mutation.reset()
    dispatch({ type })
  }
  const fieldValue = (entry: AnalysisField) => draft.fields[entry.id] ?? defaultValues.get(entry.id)!
  const fieldView = (entry: AnalysisField) => ({
    ...fieldHandlers.get(entry.id)!,
    entry, highlights: highlightsByField.get(entry.id)!, selected: state.activeFieldId === entry.id,
    active: navigation.active?.fieldId === entry.id ? navigation.active : undefined,
    review: fieldValue(entry), onSelect: selectHighlight,
  })
  const openCount = openFields.length
  const unconfirmedPositions = positionStatuses.filter((status) => status.origin !== 'manual').length
  const disabled = isPending || conflict
  const source = useMemo(() => ({ highlights, navigation }), [highlights, navigation])
  return {
    source,
    editor: {
      groups: { customerFields: groups.customerFields, inquiryFields: groups.inquiryFields, articleFields },
      trafficLight: inquiryTrafficLight(positionStatuses),
      positions, customerId: draft.customer_id, customerSuggestions,
      fields: { onlyOpen: state.onlyOpen, value: fieldValue, view: fieldView },
      fieldCount: fields.length, openCount, unconfirmedPositions, disabled,
      activeSection: reviewSection(state.activeFieldId), selectionRevision: state.selection.revision,
      canConfirmAll: !disabled && fields.length > 0 && (openCount > 0 || unconfirmedPositions > 0),
      setOnlyOpen: (onlyOpen: boolean) => dispatch({ type: 'filter', onlyOpen }),
      nextOpen: () => {
        const current = fields.findIndex((entry) => entry.id === state.activeFieldId)
        const next = fields.find((entry, index) => index > current && !fieldValue(entry).confirmed) ?? openFields[0]
        if (next) { selectField(next); focusField(next.id) }
      },
      confirmAll: () => {
        if (!disabled) dispatch({ type: 'confirmGroup', entries: fields })
      },
      confirmAndNext: (entries: AnalysisField[]) => {
        if (disabled) return
        dispatch({ type: 'confirmGroup', entries })
        const ids = new Set(entries.map((entry) => entry.id))
        const next = openFields.find((entry) => !ids.has(entry.id))
        if (next) { selectField(next); focusField(next.id) }
      },
      selectCustomer: (id: string | null) => dispatch({ type: 'customer', id }),
      selectArticle: (fieldId: string, id?: string) => dispatch({ type: 'article', fieldId, id }),
    },
    persistence: {
      dirty, saving: isPending, error: mutation.error?.message, conflict,
      assignmentsComplete,
      completed: openCount === 0 && unconfirmedPositions === 0 && assignmentsComplete,
      summary: { openCount, customerAssigned: !!draft.customer_id, assigned: positions.filter((position) => !!position.selectedId).length, total: positions.length },
      canResolveConflict: state.latest.revision > state.baseline.revision && !isPending,
      save, complete,
      reload: () => resolveConflict('reload'), reapply: () => resolveConflict('reapply'), refresh,
    },
  }
}

export type ReviewEditor = ReturnType<typeof useInquiryReview>['editor']
export type ReviewFieldEditor = ReviewEditor['fields']
export type ReviewPersistence = ReturnType<typeof useInquiryReview>['persistence']
export type PositionReview = ReviewEditor['positions'][number]
