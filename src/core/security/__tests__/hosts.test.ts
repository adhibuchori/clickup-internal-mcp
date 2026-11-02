import { expect, test } from 'bun:test';
import { isAllowedAssetUrl, mayCarryToken } from '../hosts.ts';

test('only HTTPS on ClickUp hosts or added suffixes', () => {
  expect(isAllowedAssetUrl('https://t9001.p.clickup-attachments.com/a.png', [])).toBe(true);
  expect(isAllowedAssetUrl('https://app.clickup.com/a.png', [])).toBe(true);
  expect(isAllowedAssetUrl('https://clickupusercontent.com/a.png', [])).toBe(true);
  expect(isAllowedAssetUrl('http://app.clickup.com/a.png', [])).toBe(false);
  expect(isAllowedAssetUrl('https://evilclickup.com/a.png', [])).toBe(false);
  expect(isAllowedAssetUrl('https://clickup.com.evil.io/a.png', [])).toBe(false);
  expect(isAllowedAssetUrl('https://cdn.example.com/a.png', ['.example.com'])).toBe(true);
  expect(isAllowedAssetUrl('https://cdn.example.com/a.png', ['  ', ''])).toBe(false);
  expect(isAllowedAssetUrl('not a url', [])).toBe(false);
});

test('the token goes only to ClickUp hosts', () => {
  expect(mayCarryToken('https://t1.p.clickup-attachments.com/x')).toBe(true);
  expect(mayCarryToken('https://cdn.example.com/x')).toBe(false);
  expect(mayCarryToken('::')).toBe(false);
});
