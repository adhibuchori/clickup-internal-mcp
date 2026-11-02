import { expect, test } from 'bun:test';
import { sniffImage } from '../sniff.ts';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

test('recognises image types by their first bytes', () => {
  expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0)).ext).toBe('png');
  expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0)).mime).toBe('image/jpeg');
  expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38, 0x39)).ext).toBe('gif');
  expect(
    sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)).viewable,
  ).toBe(true);
  expect(sniffImage(text('  <svg xmlns="x"></svg>'))).toEqual({
    mime: 'image/svg+xml',
    ext: 'svg',
    viewable: false,
  });
  expect(sniffImage(text('<?xml version="1.0"?><svg/>')).ext).toBe('svg');
  expect(sniffImage(text('%PDF-1.7')).ext).toBe('pdf');
  expect(sniffImage(text('<html>'))).toEqual({
    mime: 'application/octet-stream',
    ext: 'bin',
    viewable: false,
  });
  expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41)).ext).toBe('bin');
});
