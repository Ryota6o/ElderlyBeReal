import { Image } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/** 同梱アセットの寸法。取れないときは undefined。Web 版は assetSize.web.ts。 */
export function getAssetSize(source: ImageSourcePropType): { width: number; height: number } | undefined {
  const resolved = Image.resolveAssetSource(source);
  return resolved?.width && resolved?.height ? { width: resolved.width, height: resolved.height } : undefined;
}
