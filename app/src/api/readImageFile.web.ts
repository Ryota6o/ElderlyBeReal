/** アップロードする画像の長辺の上限（px）。スマホ幅の画面に高精細で出すには十分な大きさ。 */
const MAX_LONG_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Web 版の readImageFile。画像選択で返る blob: / data: の URI を読み、長辺 MAX_LONG_SIDE の JPEG に縮めて返す。
 *
 * ブラウザの画像選択は元のファイルをそのまま返すので、スマホで撮った写真だと 4000px・4MB 超になる。
 * そのまま上げると表示のたびに大きく縮小されて粗く見え、読み込みも遅いので、ここで縮めておく。
 */
export async function readImageFile(fileUri: string): Promise<ArrayBuffer> {
  const blob = await (await fetch(fileUri)).blob();
  const bitmap = await createImageBitmap(blob);

  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('画像の縮小に使う canvas を用意できませんでした。');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const resized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!resized) {
    throw new Error('画像の変換に失敗しました。');
  }
  return resized.arrayBuffer();
}
