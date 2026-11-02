/**
 * The image type from its first bytes, never from the URL or the server's header: what view_image
 * hands to the model must be what the bytes say. Unknown types are kept but never shown inline.
 */
export interface ImageType {
  readonly mime: string;
  readonly ext: string;
  /** Whether the model can read it as an image. */
  readonly viewable: boolean;
}

const UNKNOWN: ImageType = { mime: 'application/octet-stream', ext: 'bin', viewable: false };

function startsWith(bytes: Uint8Array, signature: readonly number[], at = 0): boolean {
  return signature.every((byte, i) => bytes[at + i] === byte);
}

export function sniffImage(bytes: Uint8Array): ImageType {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]))
    return { mime: 'image/png', ext: 'png', viewable: true };
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { mime: 'image/jpeg', ext: 'jpg', viewable: true };
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]))
    return { mime: 'image/gif', ext: 'gif', viewable: true };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: 'image/webp', ext: 'webp', viewable: true };
  const head = new TextDecoder().decode(bytes.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')))
    return { mime: 'image/svg+xml', ext: 'svg', viewable: false };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46]))
    return { mime: 'application/pdf', ext: 'pdf', viewable: false };
  return UNKNOWN;
}
