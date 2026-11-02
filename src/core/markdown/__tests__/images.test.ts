import { expect, test } from 'bun:test';
import { extractImages, replaceImages } from '../images.ts';

const MD = [
  '![Login screen](https://x.clickup.com/a.png "title")',
  'text ![](<https://x.clickup.com/b.png>)',
  '<img alt="Sized" width="300" src="https://x.clickup.com/c.png">',
  "<img src='https://x.clickup.com/d.png'>",
  '![again](https://x.clickup.com/a.png)',
].join('\n');

test('extractImages finds Markdown and HTML images once each, in order', () => {
  expect(extractImages(MD)).toEqual([
    { url: 'https://x.clickup.com/a.png', alt: 'Login screen' },
    { url: 'https://x.clickup.com/b.png', alt: '' },
    { url: 'https://x.clickup.com/c.png', alt: 'Sized' },
    { url: 'https://x.clickup.com/d.png', alt: '' },
  ]);
  expect(extractImages('no images')).toEqual([]);
});

test('replaceImages rewrites every occurrence', () => {
  const out = replaceImages(MD, (image) => `[${image.alt || 'img'}]`);
  expect(out).toBe('[Login screen]\ntext [img]\n[Sized]\n[img]\n[again]');
});
