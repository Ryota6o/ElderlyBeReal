import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet } from 'react-native';
import { Camera, Image as ImageIcon, Settings as SettingsIcon } from 'lucide-react-native';
import { colors } from './src/theme';
import { GroupProvider, useGroup } from './src/context/GroupContext';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PhotoScreen from './src/screens/PhotoScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ConfirmSendScreen from './src/screens/ConfirmSendScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WaitingScreen from './src/screens/WaitingScreen';
import DeathScreen from './src/screens/DeathScreen';

/**
 * 画面構成（UI フロー図準拠）
 *
 *   Welcome ─ 作成/参加 ─┬─ まご: ProfileSetup（自分とおじいの名前・年齢・アイコン）─┐
 *                        └─ おじ: Waiting（まごを待つ）───┴─ Home
 *   Home = PHOTO タブ（ゲージ・相手の写真・Good・撮影/アルバム）+ HISTORY タブ
 *   PHOTO → ConfirmSend（送信しますか？）
 *   ゲージ 0 → （白フェード）→ Death（写真が流れる → お化け → DEAD / ReBorn）→ Welcome
 */
export type RootStackParamList = {
  Welcome: undefined;
  Settings: undefined;
  Home: undefined;
  ConfirmSend: { uri: string };
  ProfileSetup: undefined;
  ProfileEdit: undefined;
  Waiting: undefined;
  Death: undefined;
};

export type HomeTabParamList = {
  Photo: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

function SettingsHeaderButton({ navigation }: { navigation: { getParent: () => any } }) {
  return (
    <Pressable
      onPress={() => navigation.getParent()?.navigate('Settings')}
      hitSlop={12}
      style={homeTabStyles.settingsButton}
      accessibilityRole="button"
      accessibilityLabel="設定"
    >
      <SettingsIcon size={24} color="#1f2933" />
    </Pressable>
  );
}

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: homeTabStyles.tabLabel,
        tabBarStyle: homeTabStyles.tabBar,
      }}
    >
      <Tab.Screen
        name="Photo"
        component={PhotoScreen}
        options={({ navigation }) => ({
          title: '写真を送る',
          tabBarIcon: ({ color, size }) => <Camera size={size} color={color} />,
          headerRight: () => <SettingsHeaderButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'アルバム',
          tabBarIcon: ({ color, size }) => <ImageIcon size={size} color={color} />,
          // モックはヘッダー無し。タイトルは画面内で描く。
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { state, isLoading } = useGroup();

  if (isLoading) {
    return null;
  }

  const initialRouteName: keyof RootStackParamList = !state ? 'Welcome' : 'Home';

  return (
    <Stack.Navigator initialRouteName={initialRouteName}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '設定' }} />
      <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="ConfirmSend"
        component={ConfirmSendScreen}
        options={{ title: '送信する写真', presentation: 'fullScreenModal' }}
      />
      {/* 同じ画面を2つの入口で使う。setup は戻れない初回設定、edit は設定からの編集。 */}
      <Stack.Screen
        name="ProfileSetup"
        component={ProfileScreen}
        options={{ title: 'プロフィール設定', headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="ProfileEdit"
        component={ProfileScreen}
        options={{ title: 'プロフィール' }}
      />
      <Stack.Screen
        name="Waiting"
        component={WaitingScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Death"
        component={DeathScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
          // 前画面が真っ白になった状態から切り替わるので、白背景のフェードで継ぎ目を消す
          animation: 'fade',
          contentStyle: { backgroundColor: '#fff' },
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GroupProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </GroupProvider>
  );
}

const homeTabStyles = StyleSheet.create({
  settingsButton: { paddingHorizontal: 12, paddingVertical: 4 },
  tabLabel: { fontSize: 12, fontWeight: 'bold' },
  tabBar: { backgroundColor: colors.card, borderTopColor: colors.border },
});
