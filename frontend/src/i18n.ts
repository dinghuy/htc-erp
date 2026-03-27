import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { authMessages } from './i18n/auth';
import { adminMessages } from './i18n/admin';
import { commonMessages } from './i18n/common';
import { dashboardMessages } from './i18n/dashboard';
import { salesMessages } from './i18n/sales';
import { settingsMessages } from './i18n/settings';

export type Locale = 'vi' | 'en';

type Params = Record<string, string | number | boolean | null | undefined>;
type MessageTable = Record<Locale, Record<string, string>>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, params?: Params) => string;
};

const DEFAULT_LOCALE: Locale = 'vi';

function mergeMessageTables(...tables: MessageTable[]): MessageTable {
  return tables.reduce<MessageTable>(
    (acc, table) => ({
      vi: { ...acc.vi, ...table.vi },
      en: { ...acc.en, ...table.en },
    }),
    { vi: {}, en: {} }
  );
}

export const messages = mergeMessageTables(
  commonMessages,
  authMessages,
  settingsMessages,
  dashboardMessages,
  salesMessages,
  adminMessages
);

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k) => {
    const v = params[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

export function translate(locale: Locale, key: string, params?: Params): string {
  const table = messages[locale] || messages[DEFAULT_LOCALE];
  const fallbackTable = messages[DEFAULT_LOCALE];
  const raw = table[key] ?? fallbackTable[key] ?? key;
  return interpolate(raw, params);
}

export const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key: string, params?: Params) => translate(DEFAULT_LOCALE, key, params),
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
