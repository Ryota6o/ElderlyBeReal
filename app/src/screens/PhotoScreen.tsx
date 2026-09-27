import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Alert } from '../alert';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { launchImageLibrary } from '../launchImageLibrary';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ThumbsUp, Camera, Images } from 'lucide-react-native';
import { useGroup } from '../context/GroupContext';
import { listPhotos, createReaction, updateLife, setLifeValue, getGroupProfile } from '../api/client';
import LifeGauge from '../components/LifeGauge';
import { colors, radius, cardShadow } from '../theme';
import { CHILD_LABEL, seniorName } from '../labels';
import WashiBackground from '../components/WashiBackground';
import WashiButton from '../components/WashiButton';
import UncleAvatar from '../../assets/avatar-uncle.svg';
import ChildAvatar from '../../assets/avatar-child.svg';
import type { GroupProfile, Photo } from '../api/types';
import type { RootStackParamList } from '../../App';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/** ゲージの減衰を画面に反映する間隔。update_life() の decay 単位（60秒）より短くしておく。 */
const LIFE_POLL_INTERVAL_MS = 15000;
/** 死亡時、画面が真っ白になるまでの時間。この間にボタンも薄れて消える。 */
const FADE_TO_WHITE_MS = 1800;
const AVATAR_SIZE = 32;

function formatDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** セクション見出しの小さな丸アイコン。写真が無ければ役割のイラストにする。 */
function Avatar({ uri, role }: { uri: string | null; role: 'child' | 'uncle' }) {
  const Fallback = role === 'child' ? ChildAvatar : UncleAvatar;
  return (
    <View style={styles.avatar}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <Fallback width={AVATAR_SIZE * 0.85} height={AVATAR_SIZE * 0.85} />
      )}
    </View>
  );
}

/**
 * PHOTO タブ。孫・おじで同じ構成。
 *
 * - 上部: 死期ゲージ
 * - 上段: 相手から届いた最新の写真と Good ボタン
 *         （まご側ならおじいの写真、おじい側ならまごの写真）
 * - 下段: 自分が最後に送った写真
 * - 最下部: 写真を撮影 ／ アルバムから送信
 *
 * ゲージが 0 になったら白くフェードして死亡演出へ（孫と爺で連動）。
 */
export default function PhotoScreen() {
  const { state } = useGroup();
  const navigation = useNavigation<Navigation>();
  const [receivedPhoto, setReceivedPhoto] = useState<Photo | null>(null);
  const [sentPhoto, setSentPhoto] = useState<Photo | null>(null);
  const [profile, setProfile] = useState<GroupProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [lifeValue, setLife] = useState<number | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const hasNavigatedToDeath = useRef(false);
  const [isDying, setIsDying] = useState(false);
  const whiteout = useRef(new Animated.Value(0)).current;

  const isChild = state?.role === 'child';
  const counterpartRole = isChild ? 'uncle' : 'child';

  // 表示名とアイコン。プロフィール未設定なら役割名・イラストにフォールバックする。
  // おじいの情報は group（elder_*）、まごの情報はまご自身の users 行にある。
  // おじい側から見た「まごの名前・アイコン」は取っていないので役割名にする。
  const counterpartName = isChild ? seniorName(profile?.elder.elder_name) : CHILD_LABEL;
  const counterpartIcon = isChild ? profile?.elder.elder_icon_url ?? null : null;
  const selfName = isChild ? profile?.self.name || 'あなた' : seniorName(profile?.elder.elder_name);
  const selfIcon = isChild ? profile?.self.icon_url ?? null : profile?.elder.elder_icon_url ?? null;

  const loadLife = useCallback(async () => {
    if (!state) {
      return;
    }
    try {
      const life = await updateLife({ groupId: state.groupId });
      setLife(life.life_value);

      // 0 になった瞬間に1回だけ遷移する。ポーリングが重なっても二重に飛ばない。
      // まず画面を白くフェードさせ（ボタンも一緒に薄れる）、真っ白になってから演出画面へ。
      if (life.life_value <= 0 && !hasNavigatedToDeath.current) {
        hasNavigatedToDeath.current = true;
        setIsDying(true);
        Animated.timing(whiteout, {
          toValue: 1,
          duration: FADE_TO_WHITE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            navigation.navigate('Death');
          }
        });
      }
    } catch (error) {
      console.error(error);
    }
  }, [state, navigation, whiteout]);

  const loadPhotos = useCallback(async () => {
    if (!state) {
      return;
    }
    setIsLoading(true);
    try {
      const [{ photos }, groupProfile] = await Promise.all([
        listPhotos(state.groupId, state.userId),
        getGroupProfile({ groupId: state.groupId, userId: state.userId }),
      ]);
      setReceivedPhoto(photos.find((photo) => photo.uploader_role === counterpartRole) ?? null);
      setSentPhoto(photos.find((photo) => photo.uploader_id === state.userId) ?? null);
      setProfile(groupProfile);
    } catch (error) {
      console.error(error);
      Alert.alert('写真の取得に失敗しました', String(error));
    } finally {
      setIsLoading(false);
    }
  }, [state, counterpartRole]);

  // 送信確認画面から戻ってきたときなどに最新状態へ更新する。
  useFocusEffect(
    useCallback(() => {
      hasNavigatedToDeath.current = false;
      setIsDying(false);
      whiteout.setValue(0);
      loadPhotos();
      loadLife();
    }, [loadPhotos, loadLife, whiteout]),
  );

  useEffect(() => {
    const timer = setInterval(loadLife, LIFE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadLife]);

  const handleGood = async () => {
    if (!state || !receivedPhoto) {
      return;
    }
    setIsReacting(true);
    try {
      const { created } = await createReaction({
        id: Crypto.randomUUID(),
        photoId: receivedPhoto.id,
        reactorId: state.userId,
        reactorRole: state.role,
      });
      setReceivedPhoto((photo) => (photo ? { ...photo, reacted: true } : photo));
      if (created) {
        await loadLife();
      } else {
        Alert.alert('Good済みです', 'この写真には既に Good しています。');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Good に失敗しました', String(error));
    } finally {
      setIsReacting(false);
    }
  };

  const pickAndConfirm = async (source: 'camera' | 'library') => {
    if (!state) {
      return;
    }
    setIsPicking(true);
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          '権限が必要です',
          source === 'camera' ? 'カメラへのアクセスを許可してください。' : 'ギャラリーへのアクセスを許可してください。',
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await launchImageLibrary(options);

      if (!result.canceled && result.assets.length > 0) {
        navigation.navigate('ConfirmSend', { uri: result.assets[0].uri });
      }
    } catch (error) {
      console.error(error);
      Alert.alert('写真の選択に失敗しました', String(error));
    } finally {
      setIsPicking(false);
    }
  };

  /**
   * デモ用: 孫側からおじいの寿命ゲージを任意に減らす（死亡画面を確認するため）。
   * 値を書いたあと loadLife() を通すので、0 にすれば通常経路で演出へ進む。
   */
  const adjustLifeForDemo = async (next: number) => {
    if (!state) {
      return;
    }
    setIsAdjusting(true);
    try {
      await setLifeValue({ groupId: state.groupId, value: next });
      await loadLife();
    } catch (error) {
      console.error(error);
      Alert.alert('寿命の変更に失敗しました', String(error));
    } finally {
      setIsAdjusting(false);
    }
  };

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>まず設定画面でグループを選んでください。</Text>
      </View>
    );
  }

  const canGood = Boolean(receivedPhoto) && !receivedPhoto?.reacted && !isReacting;

  return (
    <WashiBackground color={colors.background} style={styles.container}>
      <LifeGauge value={lifeValue} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ---- 上段: 相手からの受信写真 ---- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Avatar uri={counterpartIcon} role={counterpartRole} />
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{counterpartName}からの写真</Text>
              {receivedPhoto && <Text style={styles.sectionSub}>{formatDate(receivedPhoto.created_at)}</Text>}
            </View>
          </View>
          <View style={styles.photoCard}>
            {isLoading && !receivedPhoto ? (
              <ActivityIndicator color={colors.accent} />
            ) : receivedPhoto ? (
              <Image source={{ uri: receivedPhoto.image_url }} style={styles.photo} resizeMode="cover" />
            ) : (
              <Text style={styles.noPhoto}>まだ{counterpartName}からの写真が{'\n'}届いていません</Text>
            )}
          </View>
          <WashiButton
            color={colors.accent}
            radius={999}
            style={styles.goodButton}
            contentStyle={styles.goodButtonContent}
            onPress={handleGood}
            disabled={!canGood}
            accessibilityLabel="Good"
          >
            {isReacting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ThumbsUp size={22} color="#fff" fill={receivedPhoto?.reacted ? '#fff' : 'transparent'} />
                <Text style={styles.goodButtonText}>{receivedPhoto?.reacted ? 'Good済み' : 'Good'}</Text>
              </>
            )}
          </WashiButton>
        </View>

        {/* ---- 下段: 自分が送った写真 ---- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Avatar uri={selfIcon} role={state.role} />
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{selfName}が送った写真</Text>
              {sentPhoto && <Text style={styles.sectionSub}>{formatDate(sentPhoto.created_at)}</Text>}
            </View>
          </View>
          <View style={[styles.photoCard, styles.photoCardSmall]}>
            {sentPhoto ? (
              <Image source={{ uri: sentPhoto.image_url }} style={styles.photo} resizeMode="cover" />
            ) : (
              <Text style={styles.noPhoto}>きょうの写真をおくりましょう</Text>
            )}
          </View>
        </View>

        <View style={styles.actionRow}>
          <WashiButton color={colors.accent} onPress={() => pickAndConfirm('camera')} disabled={isPicking}>
            <Camera size={20} color="#fff" />
            <Text style={styles.actionButtonText}>写真を撮影</Text>
          </WashiButton>
          <WashiButton
            color={colors.card}
            style={styles.actionButtonSecondary}
            onPress={() => pickAndConfirm('library')}
            disabled={isPicking}
          >
            <Images size={20} color={colors.accent} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>アルバムから送信</Text>
          </WashiButton>
        </View>

        {isChild && (
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>DEMO: {counterpartName}の寿命を減らす</Text>
            <Text style={styles.demoHint}>死んだときの画面を確認するための操作です。相手の端末にも反映されます。</Text>
            <View style={styles.demoRow}>
              {[
                { label: '−10', next: (lifeValue ?? 0) - 10 },
                { label: '−30', next: (lifeValue ?? 0) - 30 },
                { label: '0 にする', next: 0 },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={[styles.demoButton, (isAdjusting || lifeValue === null) && styles.actionButtonDisabled]}
                  onPress={() => adjustLifeForDemo(item.next)}
                  disabled={isAdjusting || lifeValue === null}
                >
                  <Text style={styles.demoButtonText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 死亡時の白フェード。操作も遮る。 */}
      {isDying && (
        <Animated.View pointerEvents="auto" style={[styles.whiteout, { opacity: whiteout }]} />
      )}
    </WashiBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.ink },
  sectionSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  photoCard: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: radius.card,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...cardShadow,
  },
  photoCardSmall: { aspectRatio: 16 / 10 },
  photo: { width: '100%', height: '100%' },
  noPhoto: { color: colors.muted, textAlign: 'center', lineHeight: 22 },
  goodButton: { alignSelf: 'center', minWidth: 160 },
  goodButtonContent: { paddingHorizontal: 28, paddingVertical: 14 },
  goodButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  actionRow: { gap: 10 },
  actionButtonSecondary: { borderWidth: 1.5, borderColor: colors.accent, borderRadius: 12 },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  actionButtonTextSecondary: { color: colors.accent },
  demoBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.danger,
    backgroundColor: colors.card,
    gap: 8,
  },
  demoTitle: { fontSize: 12, fontWeight: 'bold', color: colors.danger },
  demoHint: { fontSize: 11, color: colors.muted },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  demoButtonText: { color: colors.danger, fontSize: 14, fontWeight: 'bold' },
  whiteout: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff' },
});
