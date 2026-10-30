import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/table')({
  beforeLoad: () => { throw redirect({ to: '/artikel' }) },
})
