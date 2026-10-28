import * as DocumentPicker from 'expo-document-picker';
import { setFilePickerPlatform, type FilePickerPlatform } from './filePicker';

/**
 * FilePickerPlatform backed by `expo-document-picker`: getDocumentAsync({ type, copyToCacheDirectory: true }) so the
 * returned `file://` uri can be uploaded straight away. The size comes from the picker (null when unknown).
 */
export function createFilePickerAdapter(): FilePickerPlatform {
  return {
    async pick(options) {
      const result = await DocumentPicker.getDocumentAsync({
        type: options.types ? [...options.types] : '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return null;
      return {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: typeof asset.size === 'number' ? asset.size : null,
      };
    },
  };
}

/** Called once at app start (src/app/_layout.tsx). */
export function installNativeFilePicker(): void {
  setFilePickerPlatform(createFilePickerAdapter());
}
