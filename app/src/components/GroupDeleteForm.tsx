import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { deleteGroup, listGroups } from '../api/client';
import { useGroup } from '../context/GroupContext';
import WashiButton from './WashiButton';
import { colors } from '../theme';
import type { GroupSummary } from '../api/types';

const GROUP_LIST_HEIGHT = 200;

interface Props {
  onBack: () => void;
}

/**
 * グループの削除フォーム（ホーム画面の「グループを削除」）。
 * 参加フォームと同じ一覧から1つ選び、確認のうえ削除する。
 */
export default function GroupDeleteForm({ onBack }: Props) {
  const { state, clearGroupState } = useGroup();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setGroups(null);
    try {
      setGroups(await listGroups());
    } catch (error) {
      console.error(error);
      Alert.alert('グループ一覧の取得に失敗しました', String(error));
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = () => {
    if (!selectedId) {
      Alert.alert('削除するグループを選んでください');
      return;
    }
    Alert.alert(
      `「${selectedId}」を削除しますか？`,
      'このグループのメンバー・写真・Good の記録がすべて消えます。元には戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteGroup(selectedId);
              // この端末が参加中のグループを消した場合は、端末側の設定も外す
              if (state?.groupId === selectedId) {
                await clearGroupState();
              }
              setSelectedId(null);
              await load();
              Alert.alert('削除しました', `「${selectedId}」を削除しました。`);
            } catch (error) {
              console.error(error);
              Alert.alert('削除に失敗しました', String(error));
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.group}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← 戻る</Text>
      </Pressable>
      <Text style={styles.formTitle}>グループを削除</Text>

      <Text style={styles.label}>グループ一覧</Text>
      <View style={styles.listBox}>
        {groups === null ? (
          <ActivityIndicator style={styles.listPlaceholder} color={colors.accent} />
        ) : groups.length === 0 ? (
          <Text style={[styles.listPlaceholder, styles.listEmpty]}>グループがありません</Text>
        ) : (
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {groups.map((group) => {
              const active = group.id === selectedId;
              return (
                <Pressable
                  key={group.id}
                  style={[styles.listItem, active && styles.listItemActive]}
                  onPress={() => setSelectedId(group.id)}
                >
                  <Text style={[styles.listItemId, active && styles.listItemIdActive]}>{group.id}</Text>
                  {group.elder_name && <Text style={styles.listItemSub}>{group.elder_name} のファミリー</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <WashiButton color={colors.danger} onPress={handleDelete} disabled={isDeleting || !selectedId}>
        {isDeleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.deleteButtonText}>
            {selectedId ? `「${selectedId}」を削除する` : '選択したグループを削除する'}
          </Text>
        )}
      </WashiButton>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  back: { color: colors.accent, fontSize: 16 },
  formTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  label: { fontSize: 14, color: '#555' },
  listBox: {
    height: GROUP_LIST_HEIGHT,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  listPlaceholder: { flex: 1, textAlignVertical: 'center', textAlign: 'center', paddingTop: 80 },
  listEmpty: { color: colors.muted },
  listItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemActive: { backgroundColor: '#FBE0E6' },
  listItemId: { fontSize: 16, color: colors.ink },
  listItemIdActive: { color: colors.danger, fontWeight: 'bold' },
  listItemSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
