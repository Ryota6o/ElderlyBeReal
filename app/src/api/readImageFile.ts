import { File } from 'expo-file-system';

/**
 * 端末上の画像ファイルを ArrayBuffer で読む。Web 版は readImageFile.web.ts。
 * React Native の fetch() は file:// を読めず "Network request failed" になるため、
 * expo-file-system の File 経由で読む。
 */
export function readImageFile(fileUri: string): Promise<ArrayBuffer> {
  return new File(fileUri).arrayBuffer();
}
