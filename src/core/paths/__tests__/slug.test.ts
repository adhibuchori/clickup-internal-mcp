import { expect, test } from 'bun:test';
import { slug } from '../slug.ts';

test('slug keeps ASCII words and is never empty', () => {
  expect(slug('Persyaratan Checkout — Fase 2!')).toBe('persyaratan-checkout-fase-2');
  expect(slug('Café Ünïcode')).toBe('cafe-unicode');
  expect(slug('日本語')).toBe('untitled');
  expect(slug('a'.repeat(10) + ' b', 11)).toBe('aaaaaaaaaa');
});
