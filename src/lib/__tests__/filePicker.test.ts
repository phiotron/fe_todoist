import * as DocumentPicker from 'expo-document-picker';
import { createFilePickerAdapter } from '../filePickerAdapter';
import { pickFile, setFilePickerPlatform, unavailableFilePickerPlatform } from '../filePicker';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const getDocument = DocumentPicker.getDocumentAsync as jest.MockedFunction<typeof DocumentPicker.getDocumentAsync>;

afterEach(() => setFilePickerPlatform(null));

describe('file picker port', () => {
  it('answers nothing until a platform is installed, then delegates to it', async () => {
    expect(await pickFile()).toBeNull();
    setFilePickerPlatform({ pick: async () => ({ uri: 'file:///a', name: 'a', mimeType: 'text/plain', size: 1 }) });

    expect(await pickFile({ types: ['text/plain'] })).toEqual({ uri: 'file:///a', name: 'a', mimeType: 'text/plain', size: 1 });
    setFilePickerPlatform(null);
    expect(await unavailableFilePickerPlatform.pick({})).toBeNull();
  });
});

describe('expo-document-picker adapter', () => {
  it('asks for a cached copy of one file of the wanted types and maps the asset', async () => {
    getDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/a.png', name: 'a.png', mimeType: 'image/png', size: 4096, lastModified: 0 }],
    });

    const file = await createFilePickerAdapter().pick({ types: ['image/jpeg', 'image/png'] });

    expect(getDocument).toHaveBeenCalledWith({ type: ['image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
    expect(file).toEqual({ uri: 'file:///cache/a.png', name: 'a.png', mimeType: 'image/png', size: 4096 });
  });

  it('accepts any file by default and tolerates a missing type / size', async () => {
    getDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///c/x', name: 'x', lastModified: 0 }] });

    const file = await createFilePickerAdapter().pick({});

    expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({ type: '*/*' }));
    expect(file).toEqual({ uri: 'file:///c/x', name: 'x', mimeType: 'application/octet-stream', size: null });
  });

  it('returns null when the user closes the picker', async () => {
    getDocument.mockResolvedValue({ canceled: true, assets: null });

    expect(await createFilePickerAdapter().pick({})).toBeNull();
  });
});
