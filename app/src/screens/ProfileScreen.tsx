import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera as CameraIcon, Lock } from 'lucide-react-native';
import { useGroup } from '../context/GroupContext';
import {
  getGroupProfile,
  setSelfIcon,
  setSelfNameAndAge,
  updateElderProfile,
  uploadIcon,
} from '../api/client';
import { colors, radius, cardShadow } from '../theme';
import { CHILD_LABEL, seniorName } from '../labels';
import WashiBackground from '../components/WashiBackground';
import WashiButton from '../components/WashiButton';
import UncleAvatar from '../../assets/avatar-uncle.svg';
import ChildAvatar from '../../assets/avatar-child.svg';
import type { IconTarget } from '../api/types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup' | 'ProfileEdit'>;

const AGE_MIN = 0;
const AGE_MAX = 150;
const AVATAR_SIZE = 96;

/** アイコンの丸。タップでカメラ／アルバムを選んでアップロードする。 */
function AvatarPicker({
  target,
  uri,
  isUploading,
  onPress,
}: {
  target: IconTarget;
  uri: string | null;
  isUploading: boolean;
  onPress: () => void;
}) {
  const Fallback = target === 'self' ? ChildAvatar : UncleAvatar;
  return (
    <Pressable style={styles.avatarWrap} onPress={onPress} disabled={isUploading} accessibilityLabel="アイコンを変更">
      <View style={styles.avatar}>
        {uri ? (
          <Image source={{ uri }} style={styles.avatarImage} resizeMode="cover" />
        ) : (
          <Fallback width={AVATAR_SIZE * 0.8} height={AVATAR_SIZE * 0.8} />
        )}
        {isUploading && (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.avatarBadge}>
        <CameraIcon size={14} color="#fff" />
      </View>
    </Pressable>
  );
}

/**
 * プロフィール画面（まご専用）。
 *
 * - ProfileSetup: 作成／参加直後の初回設定。自分の名前・年齢とおじいの名前・年齢を入れる。
 * - ProfileEdit : 設定から開く。おじいの名前・年齢と両方のアイコンは変更できるが、
 *                 自分の名前・年齢はそのグループ内では変更できない（ロック表示）。
 */
export default function ProfileScreen({ navigation, route }: Props) {
  const mode = route.name === 'ProfileSetup' ? 'setup' : 'edit';
  const { state } = useGroup();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<IconTarget | null>(null);

  const [selfName, setSelfName] = useState('');
  const [selfAge, setSelfAge] = useState('');
  const [selfLocked, setSelfLocked] = useState(false);
  const [selfIcon, setSelfIconUrl] = useState<string | null>(null);

  const [elderName, setElderName] = useState('');
  const [elderAge, setElderAge] = useState('');
  const [elderIcon, setElderIconUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!state) {
      return;
    }
    setIsLoading(true);
    try {
      const { elder, self } = await getGroupProfile({ groupId: state.groupId, userId: state.userId });
      // 既定の「孫」は仮の名前なので、未設定として空欄にする。
      const locked = self.age !== null;
      setSelfLocked(locked);
      setSelfName(locked ? self.name : '');
      setSelfAge(self.age === null ? '' : String(self.age));
      setSelfIconUrl(self.icon_url);
      setElderName(elder.elder_name ?? '');
      setElderAge(elder.elder_age === null ? '' : String(elder.elder_age));
      setElderIconUrl(elder.elder_icon_url);
    } catch (error) {
      console.error(error);
      Alert.alert('プロフィールの取得に失敗しました', String(error));
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  useEffect(() => {
    load();
  }, [load]);

  const pickIcon = (target: IconTarget) => {
    Alert.alert(target === 'self' ? '自分のアイコン' : `${seniorName(elderName)}のアイコン`, '写真をどこから選びますか？', [
      { text: 'カメラで撮る', onPress: () => launchPicker(target, 'camera') },
      { text: 'アルバムから選ぶ', onPress: () => launchPicker(target, 'library') },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  const launchPicker = async (target: IconTarget, source: 'camera' | 'library') => {
    if (!state) {
      return;
    }
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('権限が必要です', source === 'camera' ? 'カメラへのアクセスを許可してください。' : 'ギャラリーへのアクセスを許可してください。');
        return;
      }

      // アイコンなので正方形に切り抜く
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || result.assets.length === 0) {
        return;
      }

      setUploading(target);
      const { iconUrl } = await uploadIcon({ groupId: state.groupId, target, fileUri: result.assets[0].uri });
      // アイコンは選んだ時点で保存する（名前・年齢の保存とは独立）
      if (target === 'self') {
        await setSelfIcon({ userId: state.userId, iconUrl });
        setSelfIconUrl(iconUrl);
      } else {
        await updateElderProfile({ groupId: state.groupId, iconUrl });
        setElderIconUrl(iconUrl);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('アイコンの設定に失敗しました', String(error));
    } finally {
      setUploading(null);
    }
  };

  /**
   * 初回設定の「戻る」。作成／参加は navigation.replace で来るので履歴が無いことが多い。
   * 戻れるなら1つ前へ、無ければホームへ。グループ設定は端末に残っているので、
   * 参加し直せばこの画面から続きができる。
   */
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  };

  const parseAge = (text: string): number | null => {
    const age = Number(text);
    return Number.isInteger(age) && age >= AGE_MIN && age <= AGE_MAX ? age : null;
  };

  const handleSave = async () => {
    if (!state) {
      return;
    }
    const elderAgeValue = parseAge(elderAge);
    if (!elderName.trim() || elderAgeValue === null) {
      Alert.alert(`${seniorName(elderName)}の名前と年齢を入力してください`, `年齢は ${AGE_MIN}〜${AGE_MAX} の整数です。`);
      return;
    }
    const selfAgeValue = parseAge(selfAge);
    if (!selfLocked && (!selfName.trim() || selfAgeValue === null)) {
      Alert.alert('あなたの名前と年齢を入力してください', `年齢は ${AGE_MIN}〜${AGE_MAX} の整数です。`);
      return;
    }

    setIsSaving(true);
    try {
      await updateElderProfile({ groupId: state.groupId, name: elderName.trim(), age: elderAgeValue });
      if (!selfLocked && selfAgeValue !== null) {
        await setSelfNameAndAge({ userId: state.userId, name: selfName.trim(), age: selfAgeValue });
      }
      if (mode === 'setup') {
        navigation.replace('Home');
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('保存に失敗しました', String(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (!state) {
    return (
      <View style={styles.center}>
        <Text>まず設定画面でグループを選んでください。</Text>
      </View>
    );
  }
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <WashiBackground color={colors.background} style={styles.container}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {mode === 'setup' && (
          <View style={styles.intro}>
            <Pressable onPress={handleBack} hitSlop={8} style={styles.backLink}>
              <Text style={styles.backLinkText}>← 戻る</Text>
            </Pressable>
            <Text style={styles.introTitle}>プロフィールを設定しましょう</Text>
            <Text style={styles.introSub}>あなたの名前と年齢は、このグループでは後から変更できません。</Text>
          </View>
        )}

        {/* ---- 自分 ---- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>あなた（{CHILD_LABEL}）</Text>
            {selfLocked && (
              <View style={styles.lockPill}>
                <Lock size={12} color={colors.muted} />
                <Text style={styles.lockPillText}>名前・年齢は変更不可</Text>
              </View>
            )}
          </View>
          <View style={styles.row}>
            <AvatarPicker target="self" uri={selfIcon} isUploading={uploading === 'self'} onPress={() => pickIcon('self')} />
            <View style={styles.fields}>
              <Text style={styles.label}>名前</Text>
              <TextInput
                style={[styles.input, selfLocked && styles.inputLocked]}
                value={selfName}
                onChangeText={setSelfName}
                placeholder="たろう"
                editable={!selfLocked}
              />
              <Text style={styles.label}>年齢</Text>
              <TextInput
                style={[styles.input, styles.inputAge, selfLocked && styles.inputLocked]}
                value={selfAge}
                onChangeText={setSelfAge}
                placeholder="20"
                keyboardType="number-pad"
                maxLength={3}
                editable={!selfLocked}
              />
            </View>
          </View>
        </View>

        {/* ---- おじい ---- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{seniorName(elderName)}</Text>
          </View>
          <View style={styles.row}>
            <AvatarPicker target="elder" uri={elderIcon} isUploading={uploading === 'elder'} onPress={() => pickIcon('elder')} />
            <View style={styles.fields}>
              <Text style={styles.label}>名前</Text>
              <TextInput style={styles.input} value={elderName} onChangeText={setElderName} placeholder="私の祖父" />
              <Text style={styles.label}>年齢</Text>
              <TextInput
                style={[styles.input, styles.inputAge]}
                value={elderAge}
                onChangeText={setElderAge}
                placeholder="80"
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          </View>
        </View>

        <Text style={styles.hint}>アイコンは丸いところをタップして、カメラかアルバムから設定できます。</Text>

        <WashiButton color={colors.accent} onPress={handleSave} disabled={isSaving || uploading !== null}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{mode === 'setup' ? 'はじめる' : '保存'}</Text>
          )}
        </WashiButton>
      </ScrollView>
    </KeyboardAvoidingView>
    </WashiBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  intro: { gap: 6, paddingHorizontal: 4, paddingTop: 8 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },
  backLinkText: { color: colors.accent, fontSize: 16 },
  introTitle: { fontSize: 20, fontWeight: 'bold', color: colors.ink },
  introSub: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  card: {
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    gap: 12,
    ...cardShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.ink },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.chevronBg,
  },
  lockPillText: { fontSize: 11, color: colors.muted },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  fields: { flex: 1, gap: 6 },
  label: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  inputAge: { width: 96 },
  inputLocked: { backgroundColor: colors.chevronBg, color: colors.muted },
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
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
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
