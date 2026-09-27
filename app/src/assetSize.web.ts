import type { ImageSourcePropType } from 'react-native';

/**
 * Web 版の getAssetSize。react-native-web には Image.resolveAssetSource が無いので、
 * require() が返す番号からアセット登録簿を直接引いて寸法を取る。
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getAssetByID } = require('react-native-web/dist/modules/AssetRegistry') as {
  getAssetByID: (id: number) => { width?: number; height?: number } | undefined;
};

export function getAssetSize(source: ImageSourcePropType): { width: number; height: number } | undefined {
  if (typeof source === 'number') {
    const asset = getAssetByID(source);
    return asset?.width && asset?.height ? { width: asset.width, height: asset.height } : undefined;
  }
  if (source && !Array.isArray(source) && typeof source === 'object' && source.width && source.height) {
    return { width: source.width, height: source.height };
  }
  return undefined;
}
