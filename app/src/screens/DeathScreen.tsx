import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../alert';
import { useScreenSize } from '../useScreenSize';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGroup } from '../context/GroupContext';
import { getElderInfo, listPhotos, resetLife } from '../api/client';
import WashiButton from '../components/WashiButton';
import UncleAvatar from '../../assets/avatar-uncle.svg';
import type { Photo } from '../api/types';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Death'>;

/** 流す写真の上限。これより少なければあるだけ全部。 */
const MAX_PHOTOS = 50;
/** 残りこの枚数になったらお化けが出始める。 */
const GHOST_TRIGGER_REMAINING = 10;

/** 写真1枚の出現間隔と寿命。 */
const STAGGER_MS = 320;
const PHOTO_LIFETIME_MS = 2100;
/** お化けがぼやっと現れるのにかける時間。 */
const GHOST_FADE_MS = 3200;
/** 最後の写真が消えてから DEAD 表示までの間。 */
const DEAD_DELAY_MS = 400;

const PHOTO_MIN_SIZE = 96;
const PHOTO_MAX_SIZE = 168;
const GHOST_SIZE = 200;

interface FloatingSpec {
  photo: Photo;
  x: number;
  y: number;
  size: number;
  rotate: string;
  delay: number;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** 1枚の写真: 少し下から浮かび上がり、留まり、薄れて消える。 */
function FloatingPhoto({ spec }: { spec: FloatingSpec }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(spec.delay),
      Animated.timing(progress, {
        toValue: 1,
        duration: PHOTO_LIFETIME_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress, spec.delay]);

  const opacity = progress.interpolate({ inputRange: [0, 0.25, 0.65, 1], outputRange: [0, 1, 1, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [28, -36] });
  const scale = progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.85, 1, 1.06] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floating,
        {
          left: spec.x,
          top: spec.y,
          width: spec.size,
          height: spec.size,
          opacity,
          transform: [{ translateY }, { scale }, { rotate: spec.rotate }],
        },
      ]}
    >
      <Image source={{ uri: spec.photo.image_url }} style={styles.floatingImage} resizeMode="cover" />
    </Animated.View>
  );
}

/**
 * 死亡演出。
 *
 * 1. 白い画面に、これまで受信した写真が時を遡るようにあちこちに浮かんでは消える
 *    （ランダムに最大 50 枚）
 * 2. 残り 10 枚になったら、中央におじいちゃんのお化けがぼんやり現れる
 * 3. 全部消えたら DEAD / 享年 / ReBorn を出す
 *
 * 白へのフェードは前画面（PhotoScreen）側で行い、この画面は最初から白。
 */
export default function DeathScreen({ navigation }: Props) {
  const { state, clearGroupState } = useGroup();
  const { width, height } = useScreenSize();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [elder, setElder] = useState<{ name: string | null; age: number | null; iconUrl: string | null }>({
    name: null,
    age: null,
    iconUrl: null,
  });
  const [phase, setPhase] = useState<'floating' | 'dead'>('floating');
  const [isReborn, setIsReborn] = useState(false);

  const ghost = useRef(new Animated.Value(0)).current;
  const ghostFloat = useRef(new Animated.Value(0)).current;
  const deadFade = useRef(new Animated.Value(0)).current;

  // 受信した写真（相手が送ったもの）を優先。無ければ全部を使う。
  useEffect(() => {
    if (!state) {
      setPhotos([]);
      return;
    }
    const counterpartRole = state.role === 'child' ? 'uncle' : 'child';
    Promise.all([listPhotos(state.groupId), getElderInfo(state.groupId)])
      .then(([{ photos: all }, info]) => {
        const received = all.filter((photo) => photo.uploader_role === counterpartRole);
        setPhotos(received.length > 0 ? received : all);
        setElder({ name: info.elder_name, age: info.elder_age, iconUrl: info.elder_icon_url });
      })
      .catch((error) => {
        console.error(error);
        setPhotos([]);
      });
  }, [state]);

  // 写真ごとの位置・大きさ・出現タイミングを決める。photos が確定したときだけ計算する。
  const specs = useMemo<FloatingSpec[] | null>(() => {
    if (photos === null) {
      return null;
    }
    const picked = shuffle(photos).slice(0, MAX_PHOTOS);
    const margin = 12;
    const topSafe = 60;
    const bottomSafe = 140;
    return picked.map((photo, index) => {
      const size = PHOTO_MIN_SIZE + Math.random() * (PHOTO_MAX_SIZE - PHOTO_MIN_SIZE);
      return {
        photo,
        size,
        x: margin + Math.random() * Math.max(1, width - size - margin * 2),
        y: topSafe + Math.random() * Math.max(1, height - size - topSafe - bottomSafe),
        rotate: `${(Math.random() * 16 - 8).toFixed(1)}deg`,
        delay: index * STAGGER_MS,
      };
    });
  }, [photos, width, height]);

  // お化けの出現と DEAD への切り替えを、写真の枚数から逆算して予約する。
  useEffect(() => {
    if (specs === null) {
      return;
    }
    const total = specs.length;
    const ghostDelay = Math.max(0, total - GHOST_TRIGGER_REMAINING) * STAGGER_MS;
    const lastPhotoEnd = total === 0 ? 0 : (total - 1) * STAGGER_MS + PHOTO_LIFETIME_MS;
    const deadAt = Math.max(lastPhotoEnd, ghostDelay + GHOST_FADE_MS) + DEAD_DELAY_MS;

    const ghostAnimation = Animated.sequence([
      Animated.delay(ghostDelay),
      Animated.timing(ghost, {
        toValue: 1,
        duration: GHOST_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    ghostAnimation.start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ghostFloat, { toValue: -12, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(ghostFloat, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    floatLoop.start();

    const deadTimer = setTimeout(() => {
      setPhase('dead');
      Animated.timing(deadFade, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    }, deadAt);

    return () => {
      ghostAnimation.stop();
      floatLoop.stop();
      clearTimeout(deadTimer);
    };
  }, [specs, ghost, ghostFloat, deadFade]);

  const handleReborn = async () => {
    setIsReborn(true);
    try {
      if (state) {
        await resetLife(state.groupId);
      }
      await clearGroupState();
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    } catch (error) {
      console.error(error);
      Alert.alert('やり直しに失敗しました', String(error));
      setIsReborn(false);
    }
  };

  const ghostScale = ghost.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <View style={styles.container}>
      {specs?.map((spec) => (
        <FloatingPhoto key={spec.photo.id} spec={spec} />
      ))}

      {/* おじいちゃんのお化け: 中央でぼんやり大きくなりながら現れ、ふわふわ漂う */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ghostWrap,
          {
            left: width / 2 - GHOST_SIZE / 2,
            top: height / 2 - GHOST_SIZE / 2 - 40,
            opacity: ghost,
            transform: [{ scale: ghostScale }, { translateY: ghostFloat }],
          },
        ]}
      >
        <View style={styles.ghostGlow} />
        {/* おじいのアイコン写真があればそれを丸く、無ければイラストで */}
        <View style={styles.ghostBody}>
          {elder.iconUrl ? (
            <Image source={{ uri: elder.iconUrl }} style={styles.ghostPhoto} resizeMode="cover" />
          ) : (
            <UncleAvatar width={GHOST_SIZE * 0.7} height={GHOST_SIZE * 0.7} />
          )}
        </View>
      </Animated.View>

      {phase === 'dead' && (
        <Animated.View style={[styles.deadBlock, { opacity: deadFade }]}>
          <Text style={styles.dead}>DEAD</Text>
          <Text style={styles.age}>{elder.age === null ? '享年 --歳' : `享年${elder.age}歳`}</Text>
          {elder.name && <Text style={styles.name}>{elder.name}</Text>}
          <WashiButton
            color="#263238"
            intensity={0.35}
            radius={999}
            style={styles.rebornButton}
            contentStyle={styles.rebornContent}
            onPress={handleReborn}
            disabled={isReborn}
          >
            {isReborn ? <ActivityIndicator color="#fff" /> : <Text style={styles.rebornText}>ReBorn</Text>}
          </WashiButton>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  floating: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f2f2f2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  floatingImage: { width: '100%', height: '100%' },
  ghostWrap: {
    position: 'absolute',
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostGlow: {
    position: 'absolute',
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    borderRadius: GHOST_SIZE / 2,
    backgroundColor: 'rgba(200, 220, 255, 0.35)',
    shadowColor: '#9ec5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 12,
  },
  ghostBody: { opacity: 0.8 },
  ghostPhoto: {
    width: GHOST_SIZE * 0.7,
    height: GHOST_SIZE * 0.7,
    borderRadius: GHOST_SIZE * 0.35,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  deadBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 72,
    gap: 8,
  },
  dead: { fontSize: 56, fontWeight: '900', color: '#263238', letterSpacing: 4 },
  age: { fontSize: 22, color: '#263238' },
  name: { fontSize: 15, color: '#777' },
  rebornButton: { marginTop: 16, minWidth: 180 },
  rebornContent: { paddingHorizontal: 44, paddingVertical: 14 },
  rebornText: { color: '#fff', fontSize: 17, fontWeight: 'bold', letterSpacing: 1 },
});
