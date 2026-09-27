import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  GROUP_ID_PATTERN,
  createGroup,
  joinGroup,
  listGroups,
  normalizeGroupId,
} from '../api/client';
import { useGroup } from '../context/GroupContext';
import { resolvePostJoinRoute } from '../navigation/postJoin';
import type { PostJoinRoute } from '../navigation/postJoin';
import UncleAvatar from '../../assets/avatar-uncle.svg';
import ChildAvatar from '../../assets/avatar-child.svg';
import WashiButton from './WashiButton';
import { colors } from '../theme';
import { CHILD_LABEL, SENIOR_LABEL } from '../labels';
import type { GroupSummary, UserRole } from '../api/types';

const AVATAR_SIZE = 64;
const GROUP_LIST_HEIGHT = 180;

interface Props {
  mode: 'create' | 'join';
  onBack: () => void;
  /** 作成／参加に成功したとき。次に進む画面は呼び出し側で遷移する。 */
  onDone: (next: PostJoinRoute) => void;
}

/**
 * グループの作成／参加フォーム。Welcome と設定画面の両方から使うため、
 * 入力と登録処理をここに集約する。
 *
 * - 作成: 合言葉を決めて役割を選ぶ（UI フロー図の "id" 画面）
 * - 参加: スクロールするグループ一覧から選ぶか、合言葉を直接入力する
 */
export default function GroupForm({ mode, onBack, onDone }: Props) {
  const { state, isLoading, getDeviceUserId, setGroupState } = useGroup();
  const [groupId, setGroupId] = useState('');
  const [role, setRole] = useState<UserRole>(state?.role ?? 'uncle');
  const [isSaving, setIsSaving] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);

  useEffect(() => {
    if (mode !== 'join') {
      return;
    }
    let cancelled = false;
    listGroups()
      .then((list) => {
        if (!cancelled) {
          setGroups(list);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setGroups([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleSubmit = async () => {
    // 作成・参加のどちらも同じ形式。大文字で入力されても揃うよう正規化する。
    const normalized = normalizeGroupId(groupId);
    if (!GROUP_ID_PATTERN.test(normalized)) {
      Alert.alert(
        mode === 'create' ? '合言葉の形式が正しくありません' : 'グループを選んでください',
        '半角の英数字と - _ が使えます。3文字以上64文字以内で入力してください。',
      );
      return;
    }

    if (isLoading) {
      Alert.alert('ユーザーIDを準備しています。', '少し待ってから再度お試しください。');
      return;
    }

    setIsSaving(true);
    try {
      const userId = await getDeviceUserId(role);
      const result = mode === 'create'
        ? await createGroup({ groupId: normalized, userId, role })
        : await joinGroup({ groupId: normalized, userId, role });
      await setGroupState({ groupId: result.groupId, userId: result.userId, role });
      const next = await resolvePostJoinRoute({ groupId: result.groupId, userId: result.userId, role });
      onDone(next);
    } catch (error) {
      Alert.alert(
        mode === 'create' ? 'グループの作成に失敗しました' : 'グループへの参加に失敗しました',
        String(error),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectedId = normalizeGroupId(groupId);

  return (
    <View style={styles.group}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 戻る</Text>
      </Pressable>
      <Text style={styles.formTitle}>{mode === 'create' ? 'グループを作成' : 'グループ参加'}</Text>

      {mode === 'join' && (
        <>
          <Text style={styles.label}>グループ一覧</Text>
          <View style={styles.listBox}>
            {groups === null ? (
              <ActivityIndicator style={styles.listPlaceholder} />
            ) : groups.length === 0 ? (
              <Text style={[styles.listPlaceholder, styles.listEmpty]}>まだグループがありません</Text>
            ) : (
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {groups.map((group) => {
                  const active = group.id === selectedId;
                  return (
                    <Pressable
                      key={group.id}
                      style={[styles.listItem, active && styles.listItemActive]}
                      onPress={() => setGroupId(group.id)}
                    >
                      <Text style={[styles.listItemId, active && styles.listItemIdActive]}>
                        {group.id}
                      </Text>
                      {group.elder_name && (
                        <Text style={styles.listItemSub}>{group.elder_name} のファミリー</Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </>
      )}

      <Text style={styles.label}>
        {mode === 'create' ? '合言葉をきめる' : '合言葉（一覧にないときは直接入力）'}
      </Text>
      <TextInput
        style={styles.input}
        value={groupId}
        onChangeText={setGroupId}
        placeholder={mode === 'create' ? '例: tanaka-family' : 'ここに入力'}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {mode === 'create' && (
        <Text style={styles.hint}>
          半角の英数字と - _ が使えます（3文字以上）。この合言葉を家族に伝えてください。
        </Text>
      )}

      <Text style={styles.label}>あなたはだれ？</Text>
      <View style={styles.roleRow}>
        <Pressable
          style={[styles.roleButton, role === 'uncle' && styles.roleButtonActive]}
          onPress={() => setRole('uncle')}
          accessibilityRole="radio"
          accessibilityState={{ selected: role === 'uncle' }}
        >
          <UncleAvatar width={AVATAR_SIZE} height={AVATAR_SIZE} />
          <Text style={role === 'uncle' ? styles.roleTextActive : styles.roleText}>{SENIOR_LABEL}</Text>
        </Pressable>
        <Pressable
          style={[styles.roleButton, role === 'child' && styles.roleButtonActive]}
          onPress={() => setRole('child')}
          accessibilityRole="radio"
          accessibilityState={{ selected: role === 'child' }}
        >
          <ChildAvatar width={AVATAR_SIZE} height={AVATAR_SIZE} />
          <Text style={role === 'child' ? styles.roleTextActive : styles.roleText}>{CHILD_LABEL}</Text>
        </Pressable>
      </View>

      <WashiButton color={colors.accent} onPress={handleSubmit} disabled={isSaving}>
        <Text style={styles.primaryButtonText}>
          {isSaving ? '処理中...' : mode === 'create' ? '作成する' : '参加する'}
        </Text>
      </WashiButton>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  back: { color: colors.accent, fontSize: 16 },
  formTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  label: { fontSize: 14, color: '#555' },
  hint: { fontSize: 12, color: '#888', marginTop: -6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  listBox: {
    height: GROUP_LIST_HEIGHT,
    borderWidth: 1,
    borderColor: '#e3e6ea',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fafbfc',
  },
  listPlaceholder: { flex: 1, textAlignVertical: 'center', textAlign: 'center', paddingTop: 70 },
  listEmpty: { color: '#999' },
  listItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f2',
    backgroundColor: '#fff',
  },
  listItemActive: { backgroundColor: colors.accentSoft },
  listItemId: { fontSize: 16, color: '#333' },
  listItemIdActive: { color: colors.accent, fontWeight: 'bold' },
  listItemSub: { fontSize: 12, color: '#888', marginTop: 2 },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    // 選択時に枠だけ変える。太さは固定しないと選ぶたびにガタつく。
    borderWidth: 2,
    borderColor: '#e3e6ea',
    alignItems: 'center',
    gap: 6,
  },
  roleButtonActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  roleText: { color: '#666', fontSize: 15 },
  roleTextActive: { color: colors.accent, fontSize: 15, fontWeight: 'bold' },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
