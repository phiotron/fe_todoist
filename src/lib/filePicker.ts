/** A file chosen by the user (size is optional: some providers do not know it). */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
}

export interface PickFileOptions {
  /** MIME types offered by the system picker, e.g. ['image/jpeg', 'image/png']; default any file. */
  types?: readonly string[];
}

/**
 * Everything the app needs from the system file picker. The real adapter (src/lib/filePickerAdapter.ts, backed by
 * `expo-document-picker`) is installed once at startup in src/app/_layout.tsx via setFilePickerPlatform(); tests
 * install a fake and never load the native module. Resolves null when the user closes the picker.
 */
export interface FilePickerPlatform {
  pick(options: PickFileOptions): Promise<PickedFile | null>;
}

/** Used when no native module is installed: nothing can be picked. */
export const unavailableFilePickerPlatform: FilePickerPlatform = { pick: async () => null };

let current: FilePickerPlatform = unavailableFilePickerPlatform;

export function setFilePickerPlatform(platform: FilePickerPlatform | null): void {
  current = platform ?? unavailableFilePickerPlatform;
}

export function pickFile(options: PickFileOptions = {}): Promise<PickedFile | null> {
  return current.pick(options);
}
