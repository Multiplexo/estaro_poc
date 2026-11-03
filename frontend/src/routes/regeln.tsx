import { createFileRoute } from '@tanstack/react-router'
import { RuleManager } from '@/components/rules/rule-manager'

export const Route = createFileRoute('/regeln')({ component: RuleManager })
