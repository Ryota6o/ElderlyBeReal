/**
 * 配色。和紙のような生成りの地に、オレンジのアクセント、少し黄みがかった白のカード。
 */
export const colors = {
  /** 和紙。写真の白い紙に合わせ、わずかに緑灰みを帯びた生成り。繊維は WashiBackground で重ねる。 */
  background: '#ECE9DF',
  /** カードは和紙より一段明るい、紙の表面のような白。 */
  card: '#F9F7F1',
  accent: '#F08A24',
  accentSoft: '#FBE7CF',
  ink: '#3A2E2A',
  muted: '#8A7F7A',
  /** 罫線は和紙の繊維のような薄い茶灰。 */
  border: '#DDD8CB',
  chevronBg: '#E8E4D9',
  danger: '#E0245E',
};

export const radius = {
  card: 16,
  thumb: 10,
  pill: 999,
};

/** カードの浮き。iOS は shadow、Android は elevation。 */
export const cardShadow = {
  shadowColor: '#5A4A3A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 2,
} as const;
