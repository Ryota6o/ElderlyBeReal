import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ScrollView,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import GroupForm from '../components/GroupForm';
import GroupDeleteForm from '../components/GroupDeleteForm';
import PhotoMarquee from '../components/PhotoMarquee';
import WashiBackground from '../components/WashiBackground';
import WashiButton from '../components/WashiButton';
import { SAMPLE_PHOTOS } from '../samplePhotos';
import { colors } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
type WelcomeMode = 'menu' | 'create' | 'join' | 'delete';

const FADE_OUT_MS = 140;
const FADE_IN_MS = 220;

const SHEET_MIN_HEIGHT_RATIO = 0.26;
const SHEET_MAX_HEIGHT_RATIO = 0.66;

/** 上部は BeReal 風の黒地・白文字。下のシートは和紙。 */
const BG = '#000';
const INK = '#fff';
const MUTED = 'rgba(255,255,255,0.55)';

export default function WelcomeScreen({ navigation }: Props) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [mode, setMode] = useState<WelcomeMode>('menu');

  // 初回表示: 見出し → 写真 → ボタン の順にふわっと出す
  const introTitle = useRef(new Animated.Value(0)).current;
  const introPhotos = useRef(new Animated.Value(0)).current;
  const introSheet = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(160, [
      Animated.timing(introTitle, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(introPhotos, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(introSheet, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [introTitle, introPhotos, introSheet]);

  const contentAnim = useRef(new Animated.Value(1)).current;
  const contentTranslateY = contentAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const keyboardHeight = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    const showSub = Keyboard.addListener('keyboardWillShow', (event) => {
      Animated.timing(keyboardHeight, {
        toValue: -event.endCoordinates.height,
        duration: event.duration ?? 250,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', (event) => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: event.duration ?? 250,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  const switchMode = (next: WelcomeMode) => {
    Animated.timing(contentAnim, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start(() => {
      setMode(next);
      Animated.timing(contentAnim, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }).start();
    });
  };

  // 帯の高さ。1段目: 大、2段目: 小（左→右に逆流）、3段目: 大と小のちょうど中間。
  // 幅は写真ごとの縦横比からマーキー側が決める（縦長・横長が混在するため）。
  const bigHeight = Math.round(windowWidth * 0.58 * 2 / 3);
  const smallHeight = Math.round(windowWidth * 0.4 * 2 / 3);
  const midHeight = Math.round((bigHeight + smallHeight) / 2);
  // 写真は3段で分担する（同じ写真を全段に出すと段あたりの表示数が3倍になり無駄なため）。
  // 42枚なら 14枚ずつ。段の中では 2周ぶん並ぶので、どの段も途切れない。
  const perRow = Math.ceil(SAMPLE_PHOTOS.length / 3);
  const rows = [
    SAMPLE_PHOTOS.slice(0, perRow),
    SAMPLE_PHOTOS.slice(perRow, perRow * 2),
    SAMPLE_PHOTOS.slice(perRow * 2),
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.hero} edges={['top']} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.heroText,
            { opacity: introTitle, transform: [{ translateY: introTitle.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
          ]}
        >
          <Text style={styles.wordmark}>DIRECTLY.</Text>
          <Text style={styles.tagline}>直接のつながりを、もっと</Text>
        </Animated.View>

        <Animated.View style={[styles.marquees, { opacity: introPhotos }]}>
          <PhotoMarquee photos={rows[0]} cardHeight={bigHeight} speed={30} phase={0.15} />
          <PhotoMarquee photos={rows[1]} cardHeight={smallHeight} speed={22} phase={0.6} reverse />
          <PhotoMarquee photos={rows[2]} cardHeight={midHeight} speed={26} phase={0.35} />
        </Animated.View>
      </SafeAreaView>

      <Animated.View
        style={[
          styles.sheet,
          {
            minHeight: Math.round(windowHeight * SHEET_MIN_HEIGHT_RATIO),
            maxHeight: Math.round(windowHeight * SHEET_MAX_HEIGHT_RATIO),
            opacity: introSheet,
            transform: [
              { translateY: Animated.add(keyboardHeight, introSheet.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })) },
            ],
          },
        ]}
      >
        <WashiBackground color={colors.background} style={styles.sheetPaper}>
          <SafeAreaView style={styles.sheetInner} edges={['bottom']}>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View
                style={[styles.fadeGroup, { opacity: contentAnim, transform: [{ translateY: contentTranslateY }] }]}
              >
                {mode === 'menu' ? (
                  <>
                    <WashiButton color={colors.accent} radius={999} onPress={() => switchMode('join')}>
                      <Text style={styles.primaryButtonText}>グループ参加</Text>
                    </WashiButton>
                    {/* 作成は左寄せで 2/3、削除は右 1/3。色は同じ */}
                    <View style={styles.secondaryRow}>
                      <WashiButton
                        color={colors.card}
                        radius={999}
                        style={[styles.secondaryButton, styles.createButton]}
                        onPress={() => switchMode('create')}
                      >
                        <Text style={styles.secondaryButtonText}>グループを作成</Text>
                      </WashiButton>
                      <WashiButton
                        color={colors.card}
                        radius={999}
                        style={[styles.secondaryButton, styles.deleteButton]}
                        contentStyle={styles.deleteButtonContent}
                        onPress={() => switchMode('delete')}
                      >
                        <Text style={[styles.secondaryButtonText, styles.deleteButtonText]} numberOfLines={1}>グループを削除</Text>
                      </WashiButton>
                    </View>
                  </>
                ) : mode === 'delete' ? (
                  <GroupDeleteForm onBack={() => switchMode('menu')} />
                ) : (
                  <GroupForm
                    mode={mode}
                    onBack={() => switchMode('menu')}
                    onDone={(next) => navigation.replace(next)}
                  />
                )}
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </WashiBackground>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroText: { paddingHorizontal: 24, paddingTop: 20, gap: 6 },
  wordmark: { fontSize: 40, fontWeight: '900', color: INK, letterSpacing: -1 },
  tagline: { fontSize: 15, color: MUTED, fontWeight: '600' },
  marquees: { marginTop: 24, gap: 12 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetPaper: { flexShrink: 1 },
  sheetInner: { flexShrink: 1 },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16, gap: 8 },
  fadeGroup: { gap: 10 },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  secondaryButton: { borderWidth: 1.5, borderColor: colors.ink, borderRadius: 999 },
  createButton: { flex: 2 },
  deleteButton: { flex: 1 },
  deleteButtonContent: { paddingHorizontal: 6 },
  deleteButtonText: { fontSize: 13 },
  secondaryButtonText: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
});
