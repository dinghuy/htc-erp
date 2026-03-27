import type { Locale } from '../i18n';

export const adminMessages: Record<Locale, Record<string, string>> = {
  vi: {
    'admin.users.title': 'Quản lý nhân sự',
    'admin.users.subtitle': 'Thông tin cán bộ, nhân viên',
    'admin.users.action.add': 'Thêm nhân viên',
  },
  en: {
    'admin.users.title': 'User management',
    'admin.users.subtitle': 'Employee accounts and roles',
    'admin.users.action.add': 'Add user',
  },
};
