import React, { useEffect, useMemo, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

interface Props {
  photos: ImageSourcePropType[];
  /** 帯の高さ。各写真はこの高さに揃え、幅は縦横比から決める。 */
  cardHeight: number;
  gap?: number;
  /** 流れる速さ（px/秒）。 */
  speed?: number;
  /** 0〜1。開始位置をずらして、複数段を並べたとき同じ写真が縦に揃わないようにする。 */
  phase?: number;
  /** true で左から右へ流す。既定は右から左。 */
  reverse?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 極端に細長い写真で帯が乱れないよう、幅は高さの 0.6〜1.8 倍に収める。 */
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 1.8;

/**
 * 写真が途切れなく流れる帯（既定は右から左、reverse で左から右）。
 *
 * ループの仕組み: 列の末尾に「先頭から画面幅ぶん」だけ複製を付ける。
 * translateX が -total（列1周ぶん）まで進んだとき画面に見えているのはその複製で、
 * 0 のとき見える先頭と同じ絵になるので、そこで 0 に戻しても継ぎ目が出ない。
 * 列全体を2回並べるより Image の数が大きく減る（42枚なら 84 → 46 程度）。
 *
 * 縦長・横長が混ざっていても切り抜かずに済むよう、高さを揃えて幅を写真ごとに変える。
 * 同梱アセットは Image.resolveAssetSource で寸法が取れる。
 */
export default function PhotoMarquee({
  photos,
  cardHeight,
  gap = 12,
  speed = 28,
  phase = 0,
  reverse = false,
  style,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const { cards, total } = useMemo(() => {
    const base = photos.map((source) => {
      const resolved = Image.resolveAssetSource(source);
      const aspect = resolved?.width && resolved?.height ? resolved.width / resolved.height : 1.5;
      const clamped = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
      return { source, width: Math.round(cardHeight * clamped) };
    });
    const totalWidth = base.reduce((sum, card) => sum + card.width + gap, 0);

    // 画面幅を覆うだけ先頭を複製する（+1枚は端の欠けを防ぐ余裕）
    const tail: typeof base = [];
    let covered = 0;
    for (const card of base) {
      if (covered > screenWidth) {
        break;
      }
      tail.push(card);
      covered += card.width + gap;
    }
    if (base.length > 0 && tail.length < base.length) {
      tail.push(base[tail.length]);
    }
    return { cards: [...base, ...tail], total: totalWidth };
  }, [photos, cardHeight, gap, screenWidth]);

  const translateX = useRef(new Animated.Value(-total * phase)).current;

  useEffect(() => {
    if (photos.length === 0) {
      return;
    }
    let cancelled = false;
    const run = () => {
      // 右→左: 現在位置から -total まで動かし、0 に戻す。
      // 左→右: 現在位置から 0 まで動かし、-total に戻す。
      // 最初の1周だけ phase ぶん短くなるので、残り距離に応じて時間を計算する。
      translateX.stopAnimation((current) => {
        if (cancelled) {
          return;
        }
        const target = reverse ? 0 : -total;
        const remaining = Math.abs(target - current);
        Animated.timing(translateX, {
          toValue: target,
          duration: (remaining / speed) * 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && !cancelled) {
            translateX.setValue(reverse ? -total : 0);
            run();
          }
        });
      });
    };
    run();
    return () => {
      cancelled = true;
      translateX.stopAnimation();
    };
  }, [translateX, total, speed, reverse, photos.length]);

  return (
    <View style={[styles.clip, { height: cardHeight }, style]} pointerEvents="none">
      <Animated.View style={[styles.row, { gap, transform: [{ translateX }] }]}>
        {cards.map((card, index) => (
          <Image
            key={index}
            source={card.source}
            style={[styles.card, { width: card.width, height: cardHeight }]}
            resizeMode="cover"
            // Android: 元解像度ではなく表示サイズに近い大きさでデコードさせる。
            // これが無いと 42 枚ぶんのフル解像度ビットマップがメモリに乗り、
            // 画面を出し直したときに GC でがくつく。
            resizeMethod="resize"
            fadeDuration={0}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    borderRadius: 14,
    backgroundColor: '#222',
  },
});
