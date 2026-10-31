import type { Locale } from '../locales';
import { arMessages } from './ar';
import { enMessages, type MessageKey } from './en';
import { frMessages } from './fr';

export const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en: enMessages,
  fr: frMessages,
  ar: arMessages,
};

export { enMessages };
export type { MessageKey, MessageValues, Messages, PluralBase } from './en';
