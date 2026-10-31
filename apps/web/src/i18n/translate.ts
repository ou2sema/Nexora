import type { MessageValues } from './messages';

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, values?: MessageValues): string {
  if (!values) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
