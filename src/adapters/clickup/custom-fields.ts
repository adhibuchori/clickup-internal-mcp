/**
 * Custom field values as one readable string each. ClickUp stores a dropdown as an option index or
 * id, labels as option ids, people as user objects and dates as milliseconds; everything is mapped
 * to the names a person sees in the app. Empty fields are left out.
 */
import { formatDate } from '../../core/output/text.ts';
import type { CustomFieldData } from './schemas.ts';

type Option = NonNullable<NonNullable<CustomFieldData['type_config']>['options']>[number];
type Render = (value: unknown, options: readonly Option[], timeZone: string) => string;

function optionName(options: readonly Option[], value: unknown): string {
  const key = String(value);
  const option = options.find((o) => String(o.orderindex) === key || o.id === key);
  return option?.name ?? option?.label ?? key;
}

function named(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value);
  for (const key of ['username', 'name', 'formatted_address', 'percent_complete']) {
    const field: unknown = Reflect.get(value, key);
    if (typeof field === 'string' || typeof field === 'number') return String(field);
  }
  return JSON.stringify(value).slice(0, 200);
}

const RENDERERS: Readonly<Record<string, Render>> = {
  drop_down: (value, options) => optionName(options, value),
  labels: (value, options) =>
    Array.isArray(value) ? value.map((v) => optionName(options, v)).join(', ') : '',
  date: (value, _options, timeZone) =>
    Number(value) > 0 ? formatDate(Number(value), timeZone) : '',
  checkbox: (value) => (value === true || value === 'true' ? 'yes' : 'no'),
};

const fallback: Render = (value) =>
  Array.isArray(value) ? value.map(named).join(', ') : named(value);

export function customFields(
  fields: readonly CustomFieldData[],
  timeZone: string,
): { name: string; value: string }[] {
  return fields
    .filter((field) => field.value !== undefined && field.value !== null && field.value !== '')
    .map((field) => {
      const render = RENDERERS[field.type] ?? fallback;
      return {
        name: field.name,
        value: render(field.value, field.type_config?.options ?? [], timeZone),
      };
    })
    .filter((field) => field.value !== '');
}
