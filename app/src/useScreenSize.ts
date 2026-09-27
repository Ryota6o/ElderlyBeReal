import { useWindowDimensions } from 'react-native';

/** 画面サイズ。Web 版（useScreenSize.web.ts）は PC で開いたときスマホ枠の幅に収める。 */
export function useScreenSize(): { width: number; height: number } {
  const { width, height } = useWindowDimensions();
  return { width, height };
}
