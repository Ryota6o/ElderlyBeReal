import type { ImageSourcePropType } from 'react-native';

/**
 * ホーム画面（Welcome）に流す同梱写真（42 枚）。
 * ログイン前はグループの写真が無いので、あらかじめ用意したものを使う。
 *
 * 追加・差し替えは assets/samples/ に連番で置いてこの一覧に足すだけ。
 * 縦横比は問わない（マーキー側が各写真の寸法に合わせて幅を決める）。
 * 短辺 300px 未満の画像は画面で拡大されてぼやけるので入れない。
 */
export const SAMPLE_PHOTOS: ImageSourcePropType[] = [
  require('../assets/samples/01.jpg'),
  require('../assets/samples/02.jpg'),
  require('../assets/samples/03.jpg'),
  require('../assets/samples/04.jpg'),
  require('../assets/samples/05.jpg'),
  require('../assets/samples/06.jpeg'),
  require('../assets/samples/07.webp'),
  require('../assets/samples/08.jpg'),
  require('../assets/samples/09.jpg'),
  require('../assets/samples/10.jpg'),
  require('../assets/samples/11.jpg'),
  require('../assets/samples/12.jpg'),
  require('../assets/samples/13.jpg'),
  require('../assets/samples/14.jpg'),
  require('../assets/samples/15.jpg'),
  require('../assets/samples/16.jpg'),
  require('../assets/samples/17.jpg'),
  require('../assets/samples/18.jpg'),
  require('../assets/samples/19.jpg'),
  require('../assets/samples/20.jpg'),
  require('../assets/samples/21.jpg'),
  require('../assets/samples/22.jpg'),
  require('../assets/samples/23.jpg'),
  require('../assets/samples/24.jpg'),
  require('../assets/samples/25.jpg'),
  require('../assets/samples/26.jpg'),
  require('../assets/samples/27.jpg'),
  require('../assets/samples/28.jpg'),
  require('../assets/samples/29.jpg'),
  require('../assets/samples/30.jpg'),
  require('../assets/samples/31.jpg'),
  require('../assets/samples/32.jpg'),
  require('../assets/samples/33.jpg'),
  require('../assets/samples/34.jpg'),
  require('../assets/samples/35.jpg'),
  require('../assets/samples/36.jpg'),
  require('../assets/samples/37.jpg'),
  require('../assets/samples/38.jpg'),
  require('../assets/samples/39.jpg'),
  require('../assets/samples/40.jpg'),
  require('../assets/samples/41.jpg'),
  require('../assets/samples/42.jpg'),
];
