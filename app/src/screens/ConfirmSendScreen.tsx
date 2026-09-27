import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Alert } from '../alert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGroup } from '../context/GroupContext';
import { uploadPhoto } from '../api/client';
import WashiBackground from '../components/WashiBackground';
import WashiButton from '../components/WashiButton';
import { colors } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmSend'>;

/**
 * 送信確認（UI フロー図: 送信しますか？ No / Yes）。
 * カメラ・アルバムのどちらから来ても、ここで1枚を確認してから送る。
 */
export default function ConfirmSendScreen({ route, navigation }: Props) {
  const { state } = useGroup();
  const [isUploading, setIsUploading] = useState(false);

  const handleYes = async () => {
    if (!state) {
      Alert.alert('グループが未設定です', 'まず設定画面でグループを選んでください。');
      return;
    }

    setIsUploading(true);
    try {
      await uploadPhoto({
        groupId: state.groupId,
        uploaderId: state.userId,
        uploaderRole: state.role,
        fileUri: route.params.uri,
      });
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('送信に失敗しました', String(error));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: route.params.uri }} style={styles.image} resizeMode="contain" />

      <WashiBackground color={colors.background} style={styles.panel}>
        <Text style={styles.question}>送信しますか？</Text>
        <View style={styles.actions}>
          <WashiButton
            color={colors.card}
            radius={BUTTON_SIZE / 2}
            style={styles.noButton}
            contentStyle={styles.circleContent}
            onPress={navigation.goBack}
            disabled={isUploading}
          >
            <Text style={styles.noButtonText}>No</Text>
          </WashiButton>
          <WashiButton
            color={colors.accent}
            radius={BUTTON_SIZE / 2}
            contentStyle={styles.circleContent}
            onPress={handleYes}
            disabled={isUploading}
          >
            {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.yesButtonText}>Yes</Text>}
          </WashiButton>
        </View>
      </WashiBackground>
    </View>
  );
}

const BUTTON_SIZE = 72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1, width: '100%' },
  panel: { padding: 20, gap: 16, alignItems: 'center' },
  question: { fontSize: 18, fontWeight: 'bold', color: colors.ink },
  actions: { flexDirection: 'row', gap: 32 },
  circleContent: { width: BUTTON_SIZE, height: BUTTON_SIZE, padding: 0 },
  noButton: { borderWidth: 2, borderColor: colors.ink, borderRadius: BUTTON_SIZE / 2 },
  noButtonText: { color: colors.ink, fontSize: 18, fontWeight: 'bold' },
  yesButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
