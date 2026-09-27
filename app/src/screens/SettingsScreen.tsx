import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Alert } from '../alert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import GroupForm from '../components/GroupForm';
import WashiBackground from '../components/WashiBackground';
import WashiButton from '../components/WashiButton';
import { colors } from '../theme';
import { useGroup } from '../context/GroupContext';
import { getElderInfo } from '../api/client';
import { seniorName } from '../labels';
import type { DeviceStorageSnapshot } from '../context/GroupContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type SettingsMode = 'menu' | 'create' | 'join';

function shortId(userId: string | null): string {
  return userId ? `${userId.slice(0, 8)}…` : '未発行';
}

export default function SettingsScreen({ navigation }: Props) {
  const { state, readDeviceStorage, resetDevice } = useGroup();
  const [mode, setMode] = useState<SettingsMode>('menu');
  const [snapshot, setSnapshot] = useState<DeviceStorageSnapshot | null>(null);
  const [elderName, setElderName] = useState<string | null>(null);

  // まご側の説明文に、まごが入力したおじいの名前を出す
  useEffect(() => {
    if (state?.role !== 'child') {
      return;
    }
    getElderInfo(state.groupId)
      .then((elder) => setElderName(elder.elder_name))
      .catch((error) => console.error(error));
  }, [state]);

  const refreshSnapshot = useCallback(async () => {
    setSnapshot(await readDeviceStorage());
  }, [readDeviceStorage]);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot, state]);

  const handleReset = () => {
    Alert.alert(
      '端末データを消去しますか？',
      'user_id（まご・Senior の両方）と group_id の設定を削除し、アプリを入れ直した直後と同じ状態に戻します。サーバー上の写真は消えません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '消去する',
          style: 'destructive',
          onPress: async () => {
            await resetDevice();
            await refreshSnapshot();
            setMode('menu');
            // 未設定の Home に戻れてしまわないよう、初回起動と同じ画面から始める。
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
            Alert.alert('消去しました', '初回インストールと同じ状態になりました。');
          },
        },
      ],
    );
  };

  return (
    <WashiBackground color={colors.background} style={styles.paper}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {mode === 'menu' ? (
        <>
          {/* プロフィール（おじいの名前・年齢、両方のアイコン）はまごだけが変更できる */}
          {state?.role === 'child' && (
            <WashiButton
              color={colors.accentSoft}
              style={styles.profileButton}
              contentStyle={styles.profileButtonContent}
              onPress={() => navigation.navigate('ProfileEdit')}
            >
              <Text style={styles.profileButtonText}>プロフィールを編集</Text>
              <Text style={styles.profileButtonSub}>{seniorName(elderName)}の名前・年齢、自分と{seniorName(elderName)}のアイコン</Text>
            </WashiButton>
          )}

          <WashiButton color={colors.accent} onPress={() => setMode('create')}>
            <Text style={styles.primaryButtonText}>グループを作成</Text>
          </WashiButton>
          <WashiButton color={colors.card} style={styles.secondaryButton} onPress={() => setMode('join')}>
            <Text style={styles.secondaryButtonText}>グループ参加</Text>
          </WashiButton>

          {state && (
            <Text style={styles.current}>
              現在の設定: group_id={state.groupId} / role={state.role}
              {'\n'}user_id={state.userId}
            </Text>
          )}

          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>端末の保存状態（デバッグ）</Text>
            {snapshot === null ? (
              <Text style={styles.debugLine}>読み込み中...</Text>
            ) : snapshot.isFreshInstall ? (
              <Text style={styles.debugLine}>
                保存データなし = 初回インストール状態{'\n'}
                user_id はグループを作成／参加した時点で、選んだ役割ごとに発行されます。
              </Text>
            ) : (
              <>
                <Text style={styles.debugLine}>孫の user_id: {shortId(snapshot.childUserId)}</Text>
                <Text style={styles.debugLine}>Senior の user_id: {shortId(snapshot.uncleUserId)}</Text>
                <Text style={styles.debugLine}>
                  group_id: {snapshot.groupState?.groupId ?? '未設定'}
                </Text>
                {snapshot.legacyUserId && (
                  <Text style={styles.debugLine}>旧形式の user_id が残っています（次回起動で移行）</Text>
                )}
              </>
            )}
            <Pressable style={styles.debugButton} onPress={refreshSnapshot}>
              <Text style={styles.debugButtonText}>再読み込み</Text>
            </Pressable>
            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>端末データを消去（初回状態に戻す）</Text>
            </Pressable>
          </View>

          {/* ホーム（Welcome）へ。グループ設定は消さないので、参加し直せばそのまま続きから使える */}
          <WashiButton
            color={colors.card}
            style={styles.homeButton}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })}
          >
            <Text style={styles.homeButtonText}>ホームに戻る</Text>
          </WashiButton>
        </>
      ) : (
        <GroupForm
          mode={mode}
          onBack={() => setMode('menu')}
          onDone={(next) => navigation.replace(next)}
        />
      )}
    </ScrollView>
    </WashiBackground>
  );
}

const styles = StyleSheet.create({
  paper: { flex: 1 },
  container: { padding: 24, gap: 12, flexGrow: 1 },
  profileButton: { marginBottom: 4 },
  profileButtonContent: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingVertical: 14, paddingHorizontal: 16 },
  profileButtonText: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  profileButtonSub: { color: colors.muted, fontSize: 12 },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  secondaryButton: { borderWidth: 1.5, borderColor: colors.accent, borderRadius: 12 },
  secondaryButtonText: { color: colors.accent, fontSize: 17, fontWeight: 'bold' },
  current: { marginTop: 12, color: '#777', fontSize: 12, textAlign: 'center' },
  debugBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    gap: 4,
  },
  debugTitle: { fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 4 },
  debugLine: { fontSize: 11, color: '#777' },
  debugButton: { marginTop: 8, alignItems: 'center', paddingVertical: 6 },
  debugButtonText: { color: colors.accent, fontSize: 12 },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0245e',
  },
  resetButtonText: { color: '#e0245e', fontSize: 12, fontWeight: 'bold' },
  homeButton: { marginTop: 8, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 12 },
  homeButtonText: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
});
