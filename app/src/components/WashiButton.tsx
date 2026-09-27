import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import WashiBackground from './WashiBackground';
import { cardShadow } from '../theme';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  /** ボタンの下地色。文字色は children 側で指定する。 */
  color: string;
  /** 繊維の濃さ。濃い色のボタンは弱めにすると自然。 */
  intensity?: number;
  /** 角の丸み。ピル型なら 999。 */
  radius?: number;
  /** 外枠（幅・余白・影）。 */
  style?: StyleProp<ViewStyle>;
  /** 中身の並び（padding・flexDirection・gap など）。 */
  contentStyle?: StyleProp<ViewStyle>;
  /** 影を付けるか。背景と同系色のボタンは影で浮かせると見やすい。 */
  elevated?: boolean;
  children?: React.ReactNode;
}

/**
 * 和紙の質感を持つボタン。色を塗った紙片の上に文字を置いたような見た目にする。
 * 押下中は少し縮め、無効時は薄くする。
 */
export default function WashiButton({
  color,
  intensity = 0.6,
  radius = 12,
  style,
  contentStyle,
  elevated = true,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outer,
        { borderRadius: radius },
        elevated && cardShadow,
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <WashiBackground color={color} intensity={intensity} style={[styles.inner, { borderRadius: radius }, contentStyle]}>
        {children}
      </WashiBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {},
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
});
