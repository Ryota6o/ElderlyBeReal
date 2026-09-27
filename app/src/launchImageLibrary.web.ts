import * as ImagePicker from 'expo-image-picker';

type OpenFilePicker = (options: {
  startIn?: string;
  multiple?: boolean;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}) => Promise<Array<{ getFile: () => Promise<File> }>>;

/**
 * Web 版の launchImageLibrary。PC で「ピクチャ」フォルダから開けるようにする。
 *
 * 通常のファイル選択（<input type="file">）は最初に開くフォルダを指定できないので、
 * 対応ブラウザ（Chrome / Edge）では showOpenFilePicker の startIn: 'pictures' を使う。
 * 未対応のブラウザ（Safari / Firefox、スマホのブラウザなど）では expo-image-picker に任せる。
 */
export async function launchImageLibrary(options: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  const showOpenFilePicker = (window as unknown as { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker;
  if (!showOpenFilePicker) {
    return ImagePicker.launchImageLibraryAsync(options);
  }

  let handles;
  try {
    handles = await showOpenFilePicker({
      startIn: 'pictures',
      types: [{ description: '画像', accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] } }],
    });
  } catch (error) {
    // 選択画面を閉じたときは AbortError になる
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { canceled: true, assets: null };
    }
    throw error;
  }

  const file = await handles[0].getFile();
  return {
    canceled: false,
    assets: [{ uri: URL.createObjectURL(file), width: 0, height: 0, type: 'image', fileName: file.name, mimeType: file.type, fileSize: file.size }],
  };
}
