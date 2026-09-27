import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

const LIFE_MAX = 100;

const GREEN = '#2ecc71';
const YELLOW = '#f1c40f';
const RED = '#e0245e';

/** 残量に応じて色を変える。0 に近づくほど赤くして「死期」を意識させる。 */
function gaugeColor(value: number): string {
  if (value > 50) {
    return GREEN;
  }
  if (value > 20) {
    return YELLOW;
  }
  return RED;
}

interface Props {
  /** 0〜100。null は読み込み中。 */
  value: number | null;
}

/**
 * 死期ゲージ（UI フロー図の各画面上部）。
 * 左に数値、中央にバー、バーの先端に星を置く。
 */
export default function LifeGauge({ value }: Props) {
  const ratio = value === null ? 0 : Math.max(0, Math.min(value, LIFE_MAX)) / LIFE_MAX;
  const color = value === null ? '#ccc' : gaugeColor(value);

  return (
    <View style={styles.container}>
      <View style={styles.valueBox}>
        <Text style={styles.value}>{value === null ? '--' : value}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>死期ゲージ</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
          {/* 星はバーの先端に重ねる。0% のときも見えるよう最小位置を確保する。 */}
          <View style={[styles.starWrap, { left: `${Math.max(ratio * 100, 2)}%` }]}>
            <Star size={22} color={RED} fill={RED} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  valueBox: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  value: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  body: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e6e6e6',
    overflow: 'visible',
    justifyContent: 'center',
  },
  fill: { height: '100%', borderRadius: 7 },
  starWrap: {
    position: 'absolute',
    marginLeft: -11,
    top: -4,
  },
});
