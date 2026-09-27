import { useWindowDimensions } from 'react-native';
import { PHONE_MAX_WIDTH } from './phoneFrame';

/** Web 版の useScreenSize。App.tsx のスマホ枠と同じ幅までに抑える。 */
export function useScreenSize(): { width: number; height: number } {
  const { width, height } = useWindowDimensions();
  return { width: Math.min(width, PHONE_MAX_WIDTH), height };
}
