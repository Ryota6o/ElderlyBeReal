import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGroup } from '../context/GroupContext';
import { countMembers } from '../api/client';
import UncleAvatar from '../../assets/avatar-uncle.svg';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Waiting'>;

/** まごの参加を確認する間隔。デモ用途なので短め。 */
const POLL_INTERVAL_MS = 3000;

/**
 * おじが作成／参加した直後の待機画面（UI フロー図: まごが入るまでお待ちください…）。
 * users にまごが現れたら自動で Home へ進む。
 */
export default function WaitingScreen({ navigation }: Props) {
  const { state } = useGroup();
  const [lastError, setLastError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    let cancelled = false;
    const check = async () => {
      try {
        const childCount = await countMembers(state.groupId, 'child');
        if (!cancelled && childCount > 0) {
          navigation.replace('Home');
        }
        setLastError(null);
      } catch (error) {
        console.error(error);
        setLastError(String(error));
      }
    };

    check();
    timer.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [state, navigation]);

  return (
    <View style={styles.container}>
      <UncleAvatar width={120} height={120} />
      <Text style={styles.title}>まごが入るまで{'\n'}お待ちください...</Text>
      <ActivityIndicator style={styles.spinner} />
      {state && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>合言葉</Text>
          <Text style={styles.code}>{state.groupId}</Text>
          <Text style={styles.codeHint}>この合言葉をまごに伝えてください</Text>
        </View>
      )}
      {lastError && <Text style={styles.error}>{lastError}</Text>}

      {/* まごが先に別端末で入っていた場合など、待たずに進みたいとき用 */}
      <Pressable style={styles.skip} onPress={() => navigation.replace('Home')}>
        <Text style={styles.skipText}>待たずに進む</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#263238', lineHeight: 32 },
  spinner: { marginTop: 4 },
  codeBox: {
    marginTop: 12,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#eaf1fe',
  },
  codeLabel: { fontSize: 12, color: '#555' },
  code: { fontSize: 22, fontWeight: 'bold', color: '#2f6feb' },
  codeHint: { fontSize: 12, color: '#777' },
  error: { fontSize: 12, color: '#e0245e', textAlign: 'center' },
  skip: { marginTop: 24, paddingVertical: 8 },
  skipText: { color: '#999', fontSize: 14 },
});
