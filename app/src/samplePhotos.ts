import type { ImageSourcePropType } from 'react-native';

/**
 * ホーム画面（Welcome）に流す同梱写真（9 枚）。
 * ログイン前はグループの写真が無いので、あらかじめ用意したものを使う。
 *
 * 追加・差し替えは assets/samples/ に連番で置いてこの一覧に足すだけ。
 * 縦横比は問わない（マーキー側が各写真の寸法に合わせて幅を決める）。
 * 短辺 300px 未満の画像は画面で拡大されてぼやけるので入れない。
 * 一覧を3等分して上・中・下の段に流すので、似た写真が同じ段で隣り合わない順に並べる。
 *
 * 出典: 01・03・05・06・07・09 はゲームまてりあるず（https://game-materials.com/）、
 * 02・08 は Unsplash（https://unsplash.com/）、04 は自分で撮影。
 */
export const SAMPLE_PHOTOS: ImageSourcePropType[] = [
  require('../assets/samples/01.jpg'),
  require('../assets/samples/02.jpg'),
  require('../assets/samples/03.jpg'),
  require('../assets/samples/04.jpg'),
  require('../assets/samples/05.jpg'),
  require('../assets/samples/06.jpg'),
  require('../assets/samples/07.jpg'),
  require('../assets/samples/08.jpg'),
  require('../assets/samples/09.jpg'),
];
