import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * 和紙の質感。下地色の上に、繊維とムラだけを描いた透明 PNG をタイル状に重ねる。
 * 色を持たないテクスチャなので、どの月の色にも同じ1枚で対応できる。
 */
const FIBER_TEXTURE = require('../../assets/washi-fiber.png');

interface Props {
  /** 紙の下地色。 */
  color: string;
  /** 繊維の見え方。0 で無地、1 で最も強い。既定は控えめ。 */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export default function WashiBackground({ color, intensity = 0.7, style, children }: Props) {
  return (
    <View style={[styles.base, { backgroundColor: color }, style]}>
      <View style={styles.texture} pointerEvents="none">
        <Image
          source={FIBER_TEXTURE}
          resizeMode="repeat"
          style={[styles.textureImage, { opacity: intensity }]}
          accessible={false}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  texture: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  textureImage: { width: '100%', height: '100%' },
});
