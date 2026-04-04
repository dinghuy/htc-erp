import type { Locale } from '../i18n';

export const adminMessages: Record<Locale, Record<string, string>> = {
  vi: {
    'admin.users.title': 'Người dùng',
    'admin.users.subtitle': 'Quản lý tài khoản, phân quyền và trạng thái hoạt động của toàn hệ thống',
    'admin.users.action.add': 'Thêm người dùng',
  },
  en: {
    'admin.users.title': 'User management',
    'admin.users.subtitle': 'Manage accounts, permissions, and operational status across the system',
    'admin.users.action.add': 'Add user',
  },
};
