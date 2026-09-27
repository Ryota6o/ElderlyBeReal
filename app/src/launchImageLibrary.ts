import * as ImagePicker from 'expo-image-picker';

/** 端末のアルバムから画像を選ぶ。Web 版は launchImageLibrary.web.ts。 */
export function launchImageLibrary(options: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  return ImagePicker.launchImageLibraryAsync(options);
}
