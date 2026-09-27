import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { UserRole } from '../api/types';

/**
 * v0共通仕様: 「共通：group_idを入力、表示」
 * group_id / 自分のuser_id / role を端末内に保持し、全画面で共有する。
 */
interface GroupState {
  groupId: string;
  userId: string;
  role: UserRole;
}

/** デバッグ表示用: この端末に実際に保存されている値。 */
export interface DeviceStorageSnapshot {
  childUserId: string | null;
  uncleUserId: string | null;
  groupState: GroupState | null;
  legacyUserId: string | null;
  isFreshInstall: boolean;
}

interface GroupContextValue {
  state: GroupState | null;
  isLoading: boolean;
  getDeviceUserId: (role: UserRole) => Promise<string>;
  setGroupState: (state: GroupState) => Promise<void>;
  clearGroupState: () => Promise<void>;
  readDeviceStorage: () => Promise<DeviceStorageSnapshot>;
  resetDevice: () => Promise<void>;
}

const STORAGE_KEY = '@app/group-state';
const LEGACY_DEVICE_USER_ID_KEY = '@app/device-user-id';
function deviceUserIdKey(role: UserRole): string {
  return `${LEGACY_DEVICE_USER_ID_KEY}:${role}`;
}

const ALL_STORAGE_KEYS = [
  STORAGE_KEY,
  LEGACY_DEVICE_USER_ID_KEY,
  deviceUserIdKey('child'),
  deviceUserIdKey('uncle'),
];

const GroupContext = createContext<GroupContextValue | undefined>(undefined);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GroupState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rawState, legacyUserId] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(LEGACY_DEVICE_USER_ID_KEY),
        ]);
        const savedState = rawState ? (JSON.parse(rawState) as GroupState) : null;

        const inheritedUserId = legacyUserId ?? savedState?.userId ?? null;
        if (inheritedUserId) {
          const key = deviceUserIdKey(savedState?.role ?? 'child');
          if (!(await AsyncStorage.getItem(key))) {
            await AsyncStorage.setItem(key, inheritedUserId);
          }
          await AsyncStorage.removeItem(LEGACY_DEVICE_USER_ID_KEY);
        }

        setState(savedState);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const getDeviceUserId = useCallback(async (role: UserRole) => {
    const key = deviceUserIdKey(role);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      return stored;
    }

    const created = Crypto.randomUUID();
    await AsyncStorage.setItem(key, created);
    return created;
  }, []);

  const readDeviceStorage = useCallback(async (): Promise<DeviceStorageSnapshot> => {
    const entries = await AsyncStorage.multiGet(ALL_STORAGE_KEYS);
    const values = new Map(entries);
    const rawState = values.get(STORAGE_KEY) ?? null;

    return {
      childUserId: values.get(deviceUserIdKey('child')) ?? null,
      uncleUserId: values.get(deviceUserIdKey('uncle')) ?? null,
      groupState: rawState ? (JSON.parse(rawState) as GroupState) : null,
      legacyUserId: values.get(LEGACY_DEVICE_USER_ID_KEY) ?? null,
      isFreshInstall: entries.every(([, value]) => value === null),
    };
  }, []);

  const resetDevice = useCallback(async () => {
    await AsyncStorage.multiRemove(ALL_STORAGE_KEYS);
    setState(null);
  }, []);

  const setGroupState = async (next: GroupState) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
  };

  const clearGroupState = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setState(null);
  };

  const value = useMemo(
    () => ({
      state,
      isLoading,
      getDeviceUserId,
      setGroupState,
      clearGroupState,
      readDeviceStorage,
      resetDevice,
    }),
    [state, isLoading, getDeviceUserId, readDeviceStorage, resetDevice],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) {
    throw new Error('useGroup は GroupProvider の内側で使用してください');
  }
  return ctx;
}
