import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { InquiryPagination } from '../src/components/inquiries/inquiry-pagination'

test.each([undefined, 0, 25])('allows returning from a later page when the total is %s', (total) => {
  const html = renderToStaticMarkup(
    <InquiryPagination page={1} total={total} isPlaceholderData={false} onPageChange={() => {}} />,
  )
  const previousButton = html.match(/<button\b[^>]*>Zurück<\/button>/)?.[0]
  const nextButton = html.match(/<button\b[^>]*>Weiter<\/button>/)?.[0]

  expect(previousButton).toBeDefined()
  expect(previousButton).not.toMatch(/\sdisabled(?:="")?(?=[\s>])/)
  expect(nextButton).toMatch(/\sdisabled(?:="")?(?=[\s>])/)
  expect(html).not.toContain(' von ')
})

test('keeps navigation disabled while showing the previous page as a placeholder', () => {
  const html = renderToStaticMarkup(
    <InquiryPagination page={1} total={75} isPlaceholderData onPageChange={() => {}} />,
  )

  expect(html.match(/<button\b[^>]*\sdisabled=""[^>]*>/g)).toHaveLength(2)
})

test('hides pagination on the first page when all inquiries fit', () => {
  const html = renderToStaticMarkup(
    <InquiryPagination page={0} total={25} isPlaceholderData={false} onPageChange={() => {}} />,
  )

  expect(html).toBe('')
})
