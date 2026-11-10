import { useTranslation } from '@/i18n'
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { ruleCategoryKeys, ruleSectionKeys, ruleSections, type RuleCategory, type RuleSection } from '@/lib/rules'

export type RuleNavigationSection = RuleSection | 'all' | 'uncategorized'

interface RuleNavigationProps {
  category: RuleCategory | 'all'
  section: RuleNavigationSection
  onSelect: (category: RuleCategory | 'all', section: RuleNavigationSection) => void
}

function RuleNavigationItem({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}) {
  return <SidebarMenuItem>
    <SidebarMenuButton isActive={active} aria-current={active ? 'true' : undefined} onClick={onClick} className="h-auto min-h-9 rounded-sm px-0 py-2 text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-transparent data-active:bg-transparent data-active:text-foreground data-active:shadow-none [&>span:last-child]:whitespace-normal">
      <span>{label}</span>
    </SidebarMenuButton>
  </SidebarMenuItem>
}

export function RuleNavigation({ category, section, onSelect }: RuleNavigationProps) {
  const { t } = useTranslation()
  return <nav aria-label={t('rules.navigationLabel')} className="min-w-0 lg:sticky lg:top-6 lg:self-start">
    <Sidebar collapsible="none" className="h-auto w-full bg-transparent text-foreground lg:w-60">
      <SidebarContent className="max-h-72 gap-0 lg:max-h-[calc(100svh-10rem)]">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-3 h-auto px-0 py-1 text-sm font-medium text-muted-foreground">{t('rules.overview')}</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>
            <RuleNavigationItem label={t('rules.all')} active={category === 'all' && section === 'all'} onClick={() => onSelect('all', 'all')} />
            {(Object.keys(ruleCategoryKeys) as RuleCategory[]).map((area) => <SidebarMenuItem key={area}>
              <SidebarMenu>
                <RuleNavigationItem label={t(ruleCategoryKeys[area])} active={category === area && section === 'all'} onClick={() => onSelect(area, 'all')} />
              </SidebarMenu>
              <SidebarMenu className="pl-5">
                {ruleSections[area].map((value) => <RuleNavigationItem key={value} label={t(ruleSectionKeys[value])} active={category === area && section === value} onClick={() => onSelect(area, value)} />)}
              </SidebarMenu>
            </SidebarMenuItem>)}
            <RuleNavigationItem label={t('rules.uncategorized')} active={section === 'uncategorized'} onClick={() => onSelect('all', 'uncategorized')} />
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  </nav>
}
