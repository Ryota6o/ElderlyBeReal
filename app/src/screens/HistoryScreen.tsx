import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, X } from 'lucide-react-native';
import { useGroup } from '../context/GroupContext';
import { getElderInfo, listPhotos } from '../api/client';
import { CHILD_LABEL, seniorName } from '../labels';
import { colors, radius, cardShadow } from '../theme';
import WashiBackground from '../components/WashiBackground';
import type { Photo } from '../api/types';

const SCREEN_PADDING = 16;
const CALENDAR_COLUMNS = 7;
const CELL_GAP = 4;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
/** 年の選択肢の幅。今年を中心に前後この年数だけ出す。 */
const YEAR_RANGE = 6;
/**
 * 月の色を白で薄める割合（0 で原色、1 で真っ白）。
 * 染めた和紙のような淡さにするため、表の色をそのまま塗らずにここで柔らげる。
 */
const PAPER_WASH = 0.32;

/** #RRGGBB を白と混ぜる。 */
function mixWithWhite(hex: string, ratio: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * 旧暦の月名と、その月のカレンダー色（伝統色）。
 * ink は背景色の上で読める文字色。濃い色の月は白文字にする。
 */
const MONTHS: Array<{ name: string; reading: string; color: string; ink: string; onWhite: string }> = [
  { name: '睦月',   reading: 'むつき',     color: '#C3D825', ink: '#2F3A00', onWhite: '#7A8A00' }, // 若草色
  { name: '如月',   reading: 'きさらぎ',   color: '#F2A0A1', ink: '#5A1F20', onWhite: '#C25A5C' }, // 紅梅色
  { name: '弥生',   reading: 'やよい',     color: '#FDEFF2', ink: '#5A3A40', onWhite: '#C97A8C' }, // 桜色
  { name: '卯月',   reading: 'うづき',     color: '#BBBCDE', ink: '#2E2E55', onWhite: '#6E6FA8' }, // 藤色
  { name: '皐月',   reading: 'さつき',     color: '#B9D08B', ink: '#2E3F10', onWhite: '#5F7A2C' }, // 若葉色
  { name: '水無月', reading: 'みなづき',   color: '#9B9BD8', ink: '#20205A', onWhite: '#5C5CB0' }, // 紫陽花色（青紫）
  { name: '文月',   reading: 'ふみづき',   color: '#165E83', ink: '#FFFFFF', onWhite: '#165E83' }, // 藍色
  { name: '葉月',   reading: 'はづき',     color: '#FCC800', ink: '#4A3A00', onWhite: '#B08A00' }, // 向日葵色
  { name: '長月',   reading: 'ながつき',   color: '#762F07', ink: '#FFFFFF', onWhite: '#762F07' }, // 栗色
  { name: '神無月', reading: 'かんなづき', color: '#D3381C', ink: '#FFFFFF', onWhite: '#D3381C' }, // 紅葉色（朱色）
  { name: '霜月',   reading: 'しもつき',   color: '#AFAFB0', ink: '#2B2B2B', onWhite: '#6E6E70' }, // 銀鼠
  { name: '師走',   reading: 'しわす',     color: '#78290F', ink: '#FFFFFF', onWhite: '#78290F' }, // 深紅（指定色）
];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** カレンダーのマス目。月初の曜日ぶん null で埋め、末尾も 7 の倍数に揃える。 */
function getCalendarDays(year: number, month: number): Array<Date | null> {
  const firstWeekday = new Date(year, month, 1).getDay();
  const days: Array<Date | null> = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    days.push(new Date(year, month, day));
  }
  while (days.length % CALENDAR_COLUMNS !== 0) {
    days.push(null);
  }
  return days;
}

type PickerKind = 'year' | 'month' | 'day';

/** 年・月・日をタップしたときに出す選択シート。 */
function PickerSheet({
  kind,
  options,
  selected,
  ink,
  onSelect,
  onClose,
}: {
  kind: PickerKind | null;
  options: Array<{ value: number; label: string; sub?: string }>;
  selected: number;
  ink: string;
  onSelect: (value: number) => void;
  onClose: () => void;
}) {
  const title = kind === 'year' ? '年を選ぶ' : kind === 'month' ? '月を選ぶ' : '日を選ぶ';
  return (
    <Modal visible={kind !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={() => undefined}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="閉じる">
              <X size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.pickerGrid}>
            {options.map((option) => {
              const active = option.value === selected;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.pickerOption, active && { backgroundColor: ink, borderColor: ink }]}
                  onPress={() => onSelect(option.value)}
                >
                  <Text style={[styles.pickerOptionText, active && styles.pickerOptionTextActive]}>{option.label}</Text>
                  {option.sub && (
                    <Text style={[styles.pickerOptionSub, active && styles.pickerOptionTextActive]}>{option.sub}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * アルバムタブ。最初からカレンダーを出す。
 *
 * - 左上に選択中の日付「2026年9月4日」。年・月・日をタップするとそれぞれ選び直せる
 * - 同じ行の右端に旧暦の月名（長月 など）
 * - 月に合わせてカレンダーの背景色が変わる（伝統色）
 * - 各日付の下に、その日に受信した写真のサムネイル
 * - 日付をタップすると下にその日の写真を並べる
 *
 * 「受信」= 相手の役割が送った写真（おじい側なら孫の、孫側ならおじいの写真）。
 */
export default function HistoryScreen() {
  const { state } = useGroup();
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  });
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [elderName, setElderName] = useState<string | null>(null);

  const counterpartRole = state?.role === 'child' ? 'uncle' : 'child';
  // まご側は、まごが入力したおじいの名前で呼ぶ（未入力なら Senior）
  const counterpartLabel = state?.role === 'child' ? seniorName(elderName) : CHILD_LABEL;

  const loadPhotos = useCallback(async () => {
    if (!state) {
      return;
    }
    setIsLoading(true);
    try {
      const [response, elder] = await Promise.all([listPhotos(state.groupId), getElderInfo(state.groupId)]);
      setPhotos(response.photos);
      setElderName(elder.elder_name);
    } catch (error) {
      console.error(error);
      Alert.alert('写真の取得に失敗しました', String(error));
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos]),
  );

  const photosByDay = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const photo of photos) {
      if (photo.uploader_role !== counterpartRole) {
        continue;
      }
      const date = new Date(photo.created_at);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const key = dayKey(date);
      map.set(key, [...(map.get(key) ?? []), photo]);
    }
    return map;
  }, [photos, counterpartRole]);

  // 月を変えたとき、その月に無い日（31日など）を選んでいたら末日に丸める
  const setDate = (patch: Partial<typeof selected>) => {
    setSelected((prev) => {
      const next = { ...prev, ...patch };
      next.day = Math.min(next.day, daysInMonth(next.year, next.month));
      return next;
    });
    setPicker(null);
  };

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>まず設定画面でグループを選んでください。</Text>
      </View>
    );
  }

  const monthInfo = MONTHS[selected.month];
  const paperColor = mixWithWhite(monthInfo.color, PAPER_WASH);
  const days = getCalendarDays(selected.year, selected.month);
  const cardInnerWidth = width - SCREEN_PADDING * 2 - 12 * 2;
  const cellWidth = (cardInnerWidth - CELL_GAP * (CALENDAR_COLUMNS - 1)) / CALENDAR_COLUMNS;
  const thumbSize = cellWidth - 6;
  const selectedDate = new Date(selected.year, selected.month, selected.day);
  const selectedPhotos = photosByDay.get(dayKey(selectedDate)) ?? [];
  const monthCount = days.reduce((sum, day) => sum + (day ? (photosByDay.get(dayKey(day))?.length ?? 0) : 0), 0);

  const now = new Date();
  const pickerOptions =
    picker === 'year'
      ? Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => now.getFullYear() - YEAR_RANGE + i).map((y) => ({ value: y, label: `${y}年` }))
      : picker === 'month'
        ? MONTHS.map((m, i) => ({ value: i, label: `${i + 1}月`, sub: m.name }))
        : Array.from({ length: daysInMonth(selected.year, selected.month) }, (_, i) => ({ value: i + 1, label: `${i + 1}日` }));
  const pickerSelected = picker === 'year' ? selected.year : picker === 'month' ? selected.month : selected.day;

  return (
    <WashiBackground color={colors.background} style={styles.container}>
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ---- カレンダー本体（月の色で染めた和紙） ---- */}
        {/* 影は外側の View に。WashiBackground は overflow:hidden なので影が切れる */}
        <View style={styles.calendarShadow}>
        <WashiBackground color={paperColor} intensity={0.85} style={styles.calendarCard}>
          <View style={styles.dateRow}>
            <View style={styles.dateParts}>
              {(
                [
                  { kind: 'year' as const, label: `${selected.year}年` },
                  { kind: 'month' as const, label: `${selected.month + 1}月` },
                  { kind: 'day' as const, label: `${selected.day}日` },
                ]
              ).map((part) => (
                <Pressable key={part.kind} style={styles.datePart} onPress={() => setPicker(part.kind)} hitSlop={4}>
                  <Text style={[styles.dateText, { color: monthInfo.ink }]}>{part.label}</Text>
                  <ChevronDown size={14} color={monthInfo.ink} style={styles.dateChevron} />
                </Pressable>
              ))}
            </View>
            <View style={styles.oldMonth}>
              <Text style={[styles.oldMonthName, { color: monthInfo.ink }]}>{monthInfo.name}</Text>
              <Text style={[styles.oldMonthReading, { color: monthInfo.ink }]}>{monthInfo.reading}</Text>
            </View>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((weekday) => (
              <Text key={weekday} style={[styles.weekday, { width: cellWidth, color: monthInfo.ink }]}>
                {weekday}
              </Text>
            ))}
          </View>

          {isLoading && photos.length === 0 ? (
            <ActivityIndicator color={monthInfo.ink} style={styles.loading} />
          ) : (
            <View style={styles.calendarGrid}>
              {days.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={{ width: cellWidth, height: thumbSize + 22 }} />;
                }
                const dayPhotos = photosByDay.get(dayKey(day)) ?? [];
                const isSelected = day.getDate() === selected.day;
                return (
                  <Pressable
                    key={day.toISOString()}
                    style={[styles.dayCell, { width: cellWidth }]}
                    onPress={() => setDate({ day: day.getDate() })}
                  >
                    <View style={[styles.dayNumberWrap, isSelected && { backgroundColor: monthInfo.ink }]}>
                      <Text style={[styles.dayNumber, { color: isSelected ? paperColor : monthInfo.ink }]}>
                        {day.getDate()}
                      </Text>
                    </View>
                    <View style={[styles.thumbSlot, { width: thumbSize, height: thumbSize }]}>
                      {dayPhotos.length > 0 && (
                        <>
                          <Image source={{ uri: dayPhotos[0].image_url }} style={styles.thumb} resizeMode="cover" />
                          {dayPhotos.length > 1 && (
                            <View style={styles.moreBadge}>
                              <Text style={styles.moreBadgeText}>+{dayPhotos.length - 1}</Text>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={[styles.monthSummary, { color: monthInfo.ink }]}>
            この月に{counterpartLabel}から届いた写真: {monthCount} 枚
          </Text>
        </WashiBackground>
        </View>

        {/* ---- 選択した日の写真 ---- */}
        <View style={styles.dayList}>
          <Text style={[styles.dayListTitle, { color: monthInfo.onWhite }]}>
            {selected.month + 1}月{selected.day}日の写真
          </Text>
          {selectedPhotos.length === 0 ? (
            <Text style={styles.dayListEmpty}>この日に{counterpartLabel}からの写真はありません</Text>
          ) : (
            selectedPhotos.map((photo) => (
              <Image key={photo.id} source={{ uri: photo.image_url }} style={styles.dayListImage} resizeMode="cover" />
            ))
          )}
        </View>
      </ScrollView>

      <PickerSheet
        kind={picker}
        options={pickerOptions}
        selected={pickerSelected}
        ink={monthInfo.onWhite}
        onSelect={(value) => setDate(picker === 'year' ? { year: value } : picker === 'month' ? { month: value } : { day: value })}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
    </WashiBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scroll: { padding: SCREEN_PADDING, gap: 16, paddingBottom: 32, alignItems: 'center' },

  calendarShadow: { width: '100%', borderRadius: radius.card, ...cardShadow },
  calendarCard: {
    width: '100%',
    padding: 12,
    borderRadius: radius.card,
    gap: 8,
  },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 },
  dateParts: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  datePart: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  dateText: { fontSize: 20, fontWeight: 'bold' },
  dateChevron: { marginLeft: 1, marginRight: 4, opacity: 0.7 },
  oldMonth: { alignItems: 'flex-end' },
  oldMonthName: { fontSize: 20, fontWeight: 'bold', letterSpacing: 2 },
  oldMonthReading: { fontSize: 10, opacity: 0.8 },

  weekRow: { flexDirection: 'row', gap: CELL_GAP },
  weekday: { textAlign: 'center', fontSize: 12, fontWeight: 'bold', opacity: 0.85 },
  loading: { paddingVertical: 60 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  dayCell: { alignItems: 'center', gap: 2, paddingVertical: 1 },
  dayNumberWrap: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dayNumber: { fontSize: 12, fontWeight: 'bold' },
  thumbSlot: {
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.75)',
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  moreBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  moreBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  monthSummary: { marginTop: 4, fontSize: 11, textAlign: 'right', opacity: 0.85 },

  dayList: { width: '100%', gap: 10 },
  dayListTitle: { fontSize: 15, fontWeight: 'bold' },
  dayListEmpty: { fontSize: 13, color: colors.muted },
  dayListImage: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.border },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  pickerSheet: {
    maxHeight: '60%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: colors.ink },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  pickerOption: {
    minWidth: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  pickerOptionText: { fontSize: 15, fontWeight: 'bold', color: colors.ink },
  pickerOptionSub: { fontSize: 10, color: colors.muted, marginTop: 1 },
  pickerOptionTextActive: { color: '#fff' },
});
