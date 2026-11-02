/** Ports: image files on disk, and the optional Markdown mirror. */
export interface AssetFiles {
  write(name: string, bytes: Uint8Array): void;
  read(name: string): Uint8Array | null;
  remove(name: string): void;
}

export interface MirrorFiles {
  /** Writes a file under the mirror folder; `path` is relative and uses "/". */
  write(path: string, data: string | Uint8Array): void;
  /** Removes a folder under the mirror folder, if it exists. */
  removeDir(path: string): void;
}
