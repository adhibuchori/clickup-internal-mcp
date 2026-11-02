/** view_image and note_image: look at a mockup once, then describe it for every later read. */
import { z } from 'zod';
import { requireRef } from '../../core/refs/refs.ts';
import type { EngineDeps } from '../../engine/deps/engine-deps.types.ts';
import { findImage, noteImage, viewImage } from '../../engine/images/images.ts';
import type { Asset } from '../../ports/store.ts';
import { defineTool } from '../registry/define-tool.ts';

function locate(deps: EngineDeps, image: string): Promise<Asset> {
  const text = image.trim();
  if (/^https:\/\//i.test(text)) return findImage(deps, { url: text });
  return findImage(deps, { sha: requireRef(text, ['image']).sha });
}

const imageField = z
  .string()
  .max(4096)
  .describe('An img: reference from read_doc, or the image URL it printed.');

export const viewImageTool = defineTool({
  name: 'view_image',
  title: 'View an image',
  description:
    'Shows one image from a ClickUp doc or task (a mockup, a diagram, a screenshot) so you can read it, together with its saved note if there is one. Pass the img: reference read_doc printed, or the image URL. PNG, JPEG, GIF and WebP are shown inline up to the size limit. After looking, save what it shows with note_image so later reads need not open it again.\nExample: {"image": "img:3f2a9c1b7d4e"}',
  input: { image: imageField },
  async run({ image }, { deps }) {
    const view = viewImage(deps, await locate(deps, image));
    const head = `img:${view.asset.sha.slice(0, 12)} · ${view.mime} · ${Math.ceil(view.asset.bytes / 1024)} KB`;
    const note = view.note
      ? `\nSaved note: ${view.note}`
      : '\nNo note yet: describe it with note_image.';
    if (!view.data) return `${head}${note}\nNot shown: ${view.reason ?? 'unknown reason'}`;
    return { text: `${head}${note}`, image: { data: view.data, mimeType: view.mime } };
  },
});

export const noteImageTool = defineTool({
  name: 'note_image',
  title: 'Save a note about an image',
  description:
    'Saves a description of an image, which read_doc then prints in place of the image. Describe what matters for requirements: the screen, its fields and labels, buttons and actions, states (empty, error, loading) and any text in the image. The note belongs to the image content, so it is reused until the image changes. Stored locally only.\nExample: {"image": "img:3f2a9c1b7d4e", "note": "Checkout form: shipping address, courier dropdown, Pay button disabled until an address is chosen."}',
  input: { image: imageField, note: z.string().min(1).max(4000).describe('What the image shows.') },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async run({ image, note }, { deps }) {
    const asset = await locate(deps, image);
    noteImage(deps, asset, note);
    return `Saved the note for img:${asset.sha.slice(0, 12)}.`;
  },
});
