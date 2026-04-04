import type { AppModule } from './shared/domain/contracts';
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ChatIcon,
  CheckSquareIcon,
  ClipboardIcon,
  CompassIcon,
  DashboardIcon,
  FolderIcon,
  HeadphonesIcon,
  MoneyIcon,
  PackageIcon,
  ReceiptIcon,
  ReportIcon,
  SettingsIcon,
  TargetIcon,
  UserIcon,
  UsersIcon,
} from './ui/icons';

export type TabName = 'Workspace' | 'Records' | 'Admin';
export type NavItemDefinition = {
  label: AppModule;
  icon: (props: { size?: number; color?: string; strokeWidth?: number }) => any;
};
export type NavSectionDefinition = {
  section: string;
  items: NavItemDefinition[];
};
type ShellNavigationDefinition = {
  key: TabName;
  label: string;
  groups: NavSectionDefinition[];
};
export type VisibleShellNavigationGroup = {
  key: TabName;
  label: string;
  groups: Array<{
    section: string;
    showSectionLabel: boolean;
    items: NavItemDefinition[];
  }>;
};

const SHELL_NAVIGATION: ShellNavigationDefinition[] = [
  {
    key: 'Workspace',
    label: 'Workspace',
    groups: [
      {
        section: 'WORKSPACE',
        items: [
          { label: 'Home', icon: DashboardIcon },
          { label: 'My Work', icon: BriefcaseIcon },
          { label: 'Inbox', icon: ClipboardIcon },
          { label: 'Approvals', icon: CheckSquareIcon },
          { label: 'Projects', icon: FolderIcon },
          { label: 'Tasks', icon: CheckSquareIcon },
        ],
      },
      {
        section: 'OPERATIONS',
        items: [
          { label: 'ERP Orders', icon: ReceiptIcon },
          { label: 'Ops Overview', icon: CompassIcon },
          { label: 'Gantt', icon: CalendarIcon },
          { label: 'Ops Staff', icon: BriefcaseIcon },
          { label: 'Ops Chat', icon: ChatIcon },
        ],
      },
      {
        section: 'ANALYTICS',
        items: [{ label: 'Reports', icon: ReportIcon }],
      },
    ],
  },
  {
    key: 'Records',
    label: 'Master data',
    groups: [
      {
        section: 'COMMERCIAL',
        items: [
          { label: 'Sales', icon: MoneyIcon },
          { label: 'Leads', icon: TargetIcon },
          { label: 'Accounts', icon: BuildingIcon },
          { label: 'Contacts', icon: UserIcon },
        ],
      },
      {
        section: 'MASTER DATA',
        items: [
          { label: 'Equipment', icon: PackageIcon },
        ],
      },
    ],
  },
  {
    key: 'Admin',
    label: 'Admin',
    groups: [
      {
        section: 'QUẢN TRỊ HỆ THỐNG',
        items: [
          { label: 'Users', icon: UsersIcon },
          { label: 'EventLog', icon: ClipboardIcon },
        ],
      },
      {
        section: 'CÀI ĐẶT',
        items: [
          { label: 'Settings', icon: SettingsIcon },
          { label: 'Support', icon: HeadphonesIcon },
        ],
      },
    ],
  },
];

export function getShellNavigationGroups(
  allowedModules: AppModule[],
  translateCategoryLabel?: (group: TabName, fallback: string) => string,
): VisibleShellNavigationGroup[] {
  return SHELL_NAVIGATION
    .map((category) => {
      const groups = category.groups
        .map((group, index) => {
          const visibleItems = group.items.filter((item) => allowedModules.includes(item.label));
          if (visibleItems.length === 0) return null;

          return {
            section: group.section,
            showSectionLabel: !(category.key === 'Workspace' && index === 0),
            items: visibleItems,
          };
        })
        .filter((group): group is VisibleShellNavigationGroup['groups'][number] => Boolean(group));

      if (groups.length === 0) return null;

      return {
        key: category.key,
        label: translateCategoryLabel ? translateCategoryLabel(category.key, category.label) : category.label,
        groups,
      };
    })
    .filter((category): category is VisibleShellNavigationGroup => Boolean(category));
}
