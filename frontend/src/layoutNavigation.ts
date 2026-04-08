import {
  getAppModulePhaseOneExposure,
  type AppModule,
  type AppModulePhaseOneExposure,
} from './shared/domain/contracts';
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
  phaseOneExposure?: AppModulePhaseOneExposure;
};
export type VisibleNavItemDefinition = NavItemDefinition & {
  phaseOneExposure: AppModulePhaseOneExposure;
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
    items: VisibleNavItemDefinition[];
  }>;
};

type ShellNavigationOptions = {
  includeMaintenance?: boolean;
  forceVisibleRoutes?: AppModule[];
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
          { label: 'ERP Orders', icon: ReceiptIcon },
        ],
      },
      {
        section: 'MAINTENANCE ONLY',
        items: [
          { label: 'Ops Overview', icon: CompassIcon },
          { label: 'Gantt', icon: CalendarIcon },
          { label: 'Ops Staff', icon: BriefcaseIcon },
          { label: 'Ops Chat', icon: ChatIcon },
          { label: 'Reports', icon: ReportIcon },
        ],
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
          { label: 'Equipment', icon: PackageIcon },
        ],
      },
      {
        section: 'MAINTENANCE ONLY',
        items: [
          { label: 'Suppliers', icon: BuildingIcon },
          { label: 'Partners', icon: UsersIcon },
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
        ],
      },
      {
        section: 'CÀI ĐẶT',
        items: [
          { label: 'Settings', icon: SettingsIcon },
        ],
      },
      {
        section: 'MAINTENANCE ONLY',
        items: [
          { label: 'EventLog', icon: ClipboardIcon },
          { label: 'Support', icon: HeadphonesIcon },
        ],
      },
    ],
  },
];

export function getShellNavigationGroups(
  allowedModules: AppModule[],
  translateCategoryLabel?: (group: TabName, fallback: string) => string,
  options: ShellNavigationOptions = {},
): VisibleShellNavigationGroup[] {
  const includeMaintenance = options.includeMaintenance === true;
  const forceVisibleRoutes = new Set(options.forceVisibleRoutes || []);

  return SHELL_NAVIGATION
    .map((category) => {
      const groups = category.groups
        .map((group, index) => {
          const visibleItems = group.items.filter((item) => {
            if (!allowedModules.includes(item.label)) return false;
            const phaseOneExposure = getAppModulePhaseOneExposure(item.label);
            return phaseOneExposure !== 'maintenance' || includeMaintenance || forceVisibleRoutes.has(item.label);
          });
          if (visibleItems.length === 0) return null;

          return {
            section: group.section,
            showSectionLabel: !(category.key === 'Workspace' && index === 0),
            items: visibleItems.map((item) => ({
              ...item,
              phaseOneExposure: getAppModulePhaseOneExposure(item.label),
            })),
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
