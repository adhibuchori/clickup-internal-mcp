/** File-system-safe names for the Markdown mirror: lowercase ASCII words, never empty. */
export function slug(text: string, max = 60): string {
  const words = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
  return words || 'untitled';
}
