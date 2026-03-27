import type { JSX } from 'preact';
import {
  BuildingIcon,
  ChatIcon,
  MailIcon,
  NoteIcon,
  PhoneIcon,
  QuoteIcon,
  ReportIcon,
  TasksIcon,
  UserIcon,
  UsersIcon,
} from './icons';

function normalizeValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function renderActivityIcon(icon: unknown, category?: unknown, size = 18): JSX.Element {
  const iconKey = normalizeValue(icon);
  const categoryKey = normalizeValue(category);
  const key = iconKey || categoryKey;

  if (key.includes('phone') || key.includes('telephony') || key.includes('call') || key.includes('📞')) {
    return <PhoneIcon size={size} />;
  }
  if (key.includes('mail') || key.includes('email') || key.includes('📧')) {
    return <MailIcon size={size} />;
  }
  if (key.includes('user') || key.includes('users') || key.includes('meeting') || key.includes('👥')) {
    return key.includes('users') || key.includes('meeting') ? <UsersIcon size={size} /> : <UserIcon size={size} />;
  }
  if (key.includes('account') || key.includes('company') || key.includes('🏢')) {
    return <BuildingIcon size={size} />;
  }
  if (key.includes('task') || key.includes('todo') || key.includes('check')) {
    return <TasksIcon size={size} />;
  }
  if (key.includes('quote') || key.includes('quotation') || key.includes('proposal') || key.includes('📄')) {
    return <QuoteIcon size={size} />;
  }
  if (key.includes('note') || key.includes('log') || key.includes('event') || key.includes('📝')) {
    return <NoteIcon size={size} />;
  }
  if (key.includes('chat') || key.includes('message') || key.includes('💬')) {
    return <ChatIcon size={size} />;
  }
  return <ReportIcon size={size} />;
}
