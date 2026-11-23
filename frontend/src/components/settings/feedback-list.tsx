import { useTranslation } from '@/i18n'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useIsAdmin } from '@/hooks/use-current-user'
import { useFeedbackList } from '@/hooks/use-feedback'

export function FeedbackList() {
  const { t, i18n } = useTranslation()
  const isAdmin = useIsAdmin()
  const feedback = useFeedbackList(isAdmin)
  if (!isAdmin) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('feedback.listTitle')}</CardTitle>
        <CardDescription>{t('feedback.listDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {feedback.isPending ? <p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {feedback.isError ? <p role="alert" className="text-sm text-destructive">{feedback.error.message}</p> : null}
        {feedback.data && feedback.data.length === 0 ? <p className="text-sm text-muted-foreground">{t('feedback.empty')}</p> : null}
        {feedback.data && feedback.data.length > 0 ? (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t('feedback.date')}</TableHead>
              <TableHead>{t('feedback.kind')}</TableHead>
              <TableHead>{t('feedback.message')}</TableHead>
              <TableHead>{t('feedback.from')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {feedback.data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap align-top">{new Date(entry.created_at).toLocaleDateString(i18n.language)}</TableCell>
                  <TableCell className="whitespace-nowrap align-top">{t(`feedback.kinds.${entry.kind}`)}</TableCell>
                  <TableCell className="align-top whitespace-pre-wrap break-words">
                    {entry.message}
                    {entry.inquiry_id ? <> · <Link to="/anfragen/$inquiryId" params={{ inquiryId: entry.inquiry_id }} className="underline">{t('feedback.toInquiry')}</Link></> : null}
                  </TableCell>
                  <TableCell className="align-top">{entry.user_name}{entry.forwarded_at ? <span className="block text-xs text-muted-foreground">{t('feedback.forwarded')}</span> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  )
}
