import * as Crypto from 'expo-crypto';
import { readImageFile } from './readImageFile';
import { supabase } from './supabase';
import type {
  ElderInfo,
  GroupProfile,
  GroupSummary,
  IconTarget,
  LifeActionType,
  LifeStatus,
  ListPhotosResponse,
  Photo,
  UserRole,
} from './types';

const PHOTOS_BUCKET = 'photos';

/** 「ReBorn」でゲージを戻す値。002 の初期値と揃えている。 */
const LIFE_REBORN_VALUE = 50;

type ApiError = { message?: string; code?: string };

/**
 * PostgREST は RLS 違反を `42501`、外部キー違反を `23503` のように code で返す。
 * 原因の切り分けができるよう、メッセージに code も含める。
 */
function getErrorMessage(error: ApiError | null, fallback: string): string {
  const message = error?.message ?? fallback;
  return error?.code ? `${message} (${error.code})` : message;
}

function roleDisplayName(role: UserRole): string {
  return role === 'child' ? '孫' : 'Senior';
}

async function ensureGroupAndUser({
  groupId,
  userId,
  role,
}: {
  groupId: string;
  userId: string;
  role: UserRole;
}): Promise<void> {
  const { error: groupError } = await supabase
    .from('group')
    .upsert({ id: groupId }, { onConflict: 'id', ignoreDuplicates: true });

  if (groupError) {
    throw new Error(getErrorMessage(groupError, 'group の登録に失敗しました。'));
  }

  // 既にいる場合は何もしない。name はまごが自分で決めた値なので上書きしてはいけない。
  const { error: userError } = await supabase.from('users').upsert(
    {
      id: userId,
      group_id: groupId,
      name: roleDisplayName(role),
      role,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );

  if (userError) {
    throw new Error(getErrorMessage(userError, 'ユーザーの登録に失敗しました。'));
  }
}

/**
 * ユーザー行を対象グループに所属させる（作成・参加の共通処理）。
 *
 * 同じ端末・同じ役割の user_id は使い回すので、別グループから移ってくることがある。
 * まごの名前・年齢は「そのグループ内では初回のみ入力できる」仕様なので、
 * 別グループへ移るときは name / age を未設定に戻して、新しいグループで入れ直せるようにする。
 * アイコンはいつでも変えられるものなので引き継ぐ。
 */
async function attachUserToGroup({
  groupId,
  userId,
  role,
}: {
  groupId: string;
  userId: string;
  role: UserRole;
}): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('group_id')
    .eq('id', userId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(getErrorMessage(lookupError, 'ユーザーの確認に失敗しました。'));
  }

  let error: ApiError | null;
  if (!existing) {
    ({ error } = await supabase
      .from('users')
      .insert({ id: userId, group_id: groupId, name: roleDisplayName(role), role }));
  } else if (existing.group_id !== groupId) {
    ({ error } = await supabase
      .from('users')
      .update({ group_id: groupId, role, name: roleDisplayName(role), age: null })
      .eq('id', userId));
  } else {
    ({ error } = await supabase.from('users').update({ role }).eq('id', userId));
  }

  if (error) {
    throw new Error(getErrorMessage(error, 'グループへの登録に失敗しました。'));
  }
}

/**
 * 招待コードの形式。007_group_id_as_text.sql の CHECK 制約と揃えること。
 * 上限を 64 にしているのは、UUID で作られた既存グループを弾かないため。
 */
export const GROUP_ID_PATTERN = /^[a-z0-9_-]{3,64}$/;

/** 入力のゆらぎ（大文字・前後の空白）を吸収する。DB 側は小文字しか受け付けない。 */
export function normalizeGroupId(input: string): string {
  return input.trim().toLowerCase();
}

export async function createGroup({
  groupId,
  userId,
  role,
}: {
  groupId: string;
  userId: string;
  role: UserRole;
}): Promise<{ groupId: string; userId: string }> {
  // 既存グループを黙って乗っ取らないよう、作成時は重複を先に弾く。
  // ensureGroupAndUser() の upsert は ignoreDuplicates のため、ここで見ないと
  // 「他人のグループに参加した」状態が「作成成功」に見えてしまう。
  const { data: existing, error: existingError } = await supabase
    .from('group')
    .select('id')
    .eq('id', groupId)
    .maybeSingle();

  if (existingError) {
    throw new Error(getErrorMessage(existingError, '合言葉の確認に失敗しました。'));
  }
  if (existing) {
    throw new Error('この合言葉は既に使われています。別の合言葉にしてください。');
  }

  const { error: insertError } = await supabase.from('group').insert({ id: groupId });
  if (insertError) {
    throw new Error(getErrorMessage(insertError, 'グループの作成に失敗しました。'));
  }

  await attachUserToGroup({ groupId, userId, role });
  return { groupId, userId };
}

export async function joinGroup({
  groupId,
  userId,
  role,
}: {
  groupId: string;
  userId: string;
  role: UserRole;
}): Promise<{ groupId: string; userId: string }> {
  const { data: group, error: groupError } = await supabase
    .from('group')
    .select('id')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) {
    throw new Error(getErrorMessage(groupError, 'グループの確認に失敗しました。'));
  }
  if (!group) {
    throw new Error('指定された合言葉のグループが見つかりません。');
  }

  await attachUserToGroup({ groupId, userId, role });
  return { groupId, userId };
}

/** 参加画面の「スクロールで流れるグループ一覧」。新しいものから並べる。 */
export async function listGroups(): Promise<GroupSummary[]> {
  const { data, error } = await supabase
    .from('group')
    .select('id, elder_name, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(getErrorMessage(error, 'グループ一覧の取得に失敗しました。'));
  }

  return (data ?? []) as GroupSummary[];
}

/**
 * グループを削除する。users / photos / reactions は ON DELETE CASCADE で一緒に消える。
 * Storage 上の画像ファイルは anon に DELETE ポリシーが無いため残る（004 参照）。
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('group').delete().eq('id', groupId);

  if (error) {
    throw new Error(getErrorMessage(error, 'グループの削除に失敗しました。'));
  }
}

export async function getElderInfo(groupId: string): Promise<ElderInfo> {
  const { data, error } = await supabase
    .from('group')
    .select('elder_name, elder_age, elder_icon_url')
    .eq('id', groupId)
    .single();

  if (error) {
    throw new Error(getErrorMessage(error, 'グループ情報の取得に失敗しました。'));
  }

  return data as ElderInfo;
}

/** おじいと自分のプロフィールをまとめて取る（プロフィール画面・PHOTO 画面用）。 */
export async function getGroupProfile({
  groupId,
  userId,
}: {
  groupId: string;
  userId: string;
}): Promise<GroupProfile> {
  const [elder, selfResult] = await Promise.all([
    getElderInfo(groupId),
    supabase.from('users').select('name, age, icon_url').eq('id', userId).maybeSingle(),
  ]);

  if (selfResult.error) {
    throw new Error(getErrorMessage(selfResult.error, 'プロフィールの取得に失敗しました。'));
  }

  return {
    elder,
    self: (selfResult.data as GroupProfile['self'] | null) ?? { name: '', age: null, icon_url: null },
  };
}

/** おじいのプロフィール。渡した項目だけ更新する。まごが設定画面からいつでも変えられる。 */
export async function updateElderProfile({
  groupId,
  name,
  age,
  iconUrl,
}: {
  groupId: string;
  name?: string;
  age?: number;
  iconUrl?: string;
}): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.elder_name = name;
  if (age !== undefined) patch.elder_age = age;
  if (iconUrl !== undefined) patch.elder_icon_url = iconUrl;
  if (Object.keys(patch).length === 0) {
    return;
  }

  const { error } = await supabase.from('group').update(patch).eq('id', groupId);

  if (error) {
    throw new Error(getErrorMessage(error, 'Senior の情報の保存に失敗しました。'));
  }
}

/**
 * まご自身の名前・年齢。そのグループ内では最初の1回しか設定できない。
 * 既に age が入っていれば拒否する（画面側でも入力欄をロックするが、二重に守る）。
 */
export async function setSelfNameAndAge({
  userId,
  name,
  age,
}: {
  userId: string;
  name: string;
  age: number;
}): Promise<void> {
  const { data: current, error: lookupError } = await supabase
    .from('users')
    .select('age')
    .eq('id', userId)
    .single();

  if (lookupError) {
    throw new Error(getErrorMessage(lookupError, 'プロフィールの確認に失敗しました。'));
  }
  if (current.age !== null) {
    throw new Error('名前と年齢は一度決めると変更できません。');
  }

  const { error } = await supabase.from('users').update({ name, age }).eq('id', userId);

  if (error) {
    throw new Error(getErrorMessage(error, 'プロフィールの保存に失敗しました。'));
  }
}

export async function setSelfIcon({ userId, iconUrl }: { userId: string; iconUrl: string }): Promise<void> {
  const { error } = await supabase.from('users').update({ icon_url: iconUrl }).eq('id', userId);

  if (error) {
    throw new Error(getErrorMessage(error, 'アイコンの保存に失敗しました。'));
  }
}

/** 端末上の画像ファイルを Storage に上げ、公開 URL を返す。写真・アイコン共通。 */
async function uploadImageFile(objectPath: string, fileUri: string): Promise<string> {
  // 端末上のファイルの読み方はスマホと Web で違うので readImageFile に任せる（詳細はそちら）。
  // Blob をそのまま渡すと、エラーにならないまま0バイトのオブジェクトが
  // 作成されることがあるため、ArrayBuffer に変換してから渡す。
  let file: ArrayBuffer;
  try {
    file = await readImageFile(fileUri);
  } catch (cause) {
    throw new Error(`画像ファイルの読み込みに失敗しました。(${String(cause)})`);
  }

  if (file.byteLength === 0) {
    throw new Error('画像ファイルの読み込み結果が0バイトでした。');
  }

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(objectPath, file, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    throw new Error(getErrorMessage(uploadError, '画像のアップロードに失敗しました。'));
  }

  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

/**
 * アイコン画像を Storage に上げて公開 URL を返す。DB への保存は呼び出し側で行う。
 * ファイル名に時刻を含めるのは、同じ URL のままだと端末側の画像キャッシュが更新されないため。
 */
export async function uploadIcon({
  groupId,
  target,
  fileUri,
}: {
  groupId: string;
  target: IconTarget;
  fileUri: string;
}): Promise<{ iconUrl: string }> {
  const objectPath = `${groupId}/icons/${target}-${Date.now()}.jpg`;
  return { iconUrl: await uploadImageFile(objectPath, fileUri) };
}

/** おじの待機画面で「まごが入ったか」を確認するのに使う。 */
export async function countMembers(groupId: string, role: UserRole): Promise<number> {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('role', role);

  if (error) {
    throw new Error(getErrorMessage(error, 'メンバーの確認に失敗しました。'));
  }

  return count ?? 0;
}

export async function updateLife({
  groupId,
  userId,
  actionType = null,
}: {
  groupId: string;
  userId?: string;
  actionType?: LifeActionType | null;
}): Promise<LifeStatus> {
  const { data, error } = await supabase.rpc('update_life', {
    target_group_id: groupId,
    actor_user_id: userId ?? null,
    action_type: actionType,
  });

  if (error) {
    throw new Error(getErrorMessage(error, '寿命の更新に失敗しました。'));
  }

  const life = (data as LifeStatus[] | null)?.[0];
  if (!life) {
    throw new Error('寿命の更新結果を取得できませんでした。');
  }

  return life;
}

/**
 * ゲージを任意の値に設定する。
 * RLS が anon に group の UPDATE を許しているので直接書く（005 参照）。
 * update_life() を経由しないのは、あちらが「減らす／加算する」専用で
 * 任意の値に設定する入口を持たないため。
 *
 * 用途は「ReBorn」でのリセットと、孫側のデモ操作（死亡画面を見るために減らす）。
 * 基準時刻も now() に揃えるので、設定直後の自然減衰は 0 からやり直しになる。
 */
export async function setLifeValue({
  groupId,
  value,
}: {
  groupId: string;
  value: number;
}): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const { error } = await supabase
    .from('group')
    .update({ life_value: clamped, life_updated_at: new Date().toISOString() })
    .eq('id', groupId);

  if (error) {
    throw new Error(getErrorMessage(error, '寿命の設定に失敗しました。'));
  }
}

/** 「ReBorn」: ゲージを初期値に戻す。 */
export async function resetLife(groupId: string): Promise<void> {
  await setLifeValue({ groupId, value: LIFE_REBORN_VALUE });
}

export async function uploadPhoto({
  groupId,
  uploaderId,
  uploaderRole,
  fileUri,
}: {
  groupId: string;
  uploaderId: string;
  uploaderRole: UserRole;
  fileUri: string;
}): Promise<{ imageUrl: string }> {
  await ensureGroupAndUser({ groupId, userId: uploaderId, role: uploaderRole });

  const photoId = Crypto.randomUUID();
  const imageUrl = await uploadImageFile(`${groupId}/${photoId}.jpg`, fileUri);

  const { error: photoError } = await supabase.from('photos').insert({
    id: photoId,
    group_id: groupId,
    uploader_id: uploaderId,
    image_url: imageUrl,
  });

  if (photoError) {
    throw new Error(getErrorMessage(photoError, '写真情報の登録に失敗しました。'));
  }

  // 008 以降は役割を問わず photo_upload で加算できる。
  await updateLife({ groupId, userId: uploaderId, actionType: 'photo_upload' });

  return { imageUrl };
}

/**
 * viewerId を渡すと、各写真に「その人が既にリアクション済みか」(`reacted`) を付けて返す。
 * reactions は UNIQUE (photo_id, reactor_id) なので、2回目の insert は 23505 で弾かれる。
 * 画面側でボタンを無効化するための判定に使う。
 */
export async function listPhotos(
  groupId: string,
  viewerId?: string,
): Promise<ListPhotosResponse> {
  const [photosResult, usersResult] = await Promise.all([
    supabase
      .from('photos')
      .select('id, group_id, uploader_id, image_url, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
    supabase.from('users').select('id, role').eq('group_id', groupId),
  ]);

  if (photosResult.error) {
    throw new Error(getErrorMessage(photosResult.error, '写真の取得に失敗しました。'));
  }
  if (usersResult.error) {
    throw new Error(getErrorMessage(usersResult.error, 'メンバーの取得に失敗しました。'));
  }

  const roleByUserId = new Map(
    (usersResult.data ?? []).map((user) => [user.id as string, user.role as UserRole]),
  );

  const photoIds = (photosResult.data ?? []).map((photo) => photo.id as string);
  let reactedPhotoIds = new Set<string>();

  if (viewerId && photoIds.length > 0) {
    const { data: reactions, error: reactionsError } = await supabase
      .from('reactions')
      .select('photo_id')
      .eq('reactor_id', viewerId)
      .in('photo_id', photoIds);

    if (reactionsError) {
      throw new Error(
        getErrorMessage(reactionsError, 'リアクション状況の取得に失敗しました。'),
      );
    }

    reactedPhotoIds = new Set(
      (reactions ?? []).map((reaction) => reaction.photo_id as string),
    );
  }

  const photos = (photosResult.data ?? []).map((photo) => ({
    ...photo,
    uploader_role: roleByUserId.get(photo.uploader_id as string) ?? null,
    reacted: reactedPhotoIds.has(photo.id as string),
  })) as Photo[];

  return { photos };
}

/**
 * 「Good」。戻り値の `created` が false のときは、その写真に既にリアクション済みだったことを表す。
 * UNIQUE (photo_id, reactor_id) 違反（23505）はエラーではなく「済み」として扱い、
 * 寿命ゲージも加算しない（連打で寿命を稼げないようにする）。
 */
export async function createReaction({
  id,
  photoId,
  reactorId,
  reactorRole,
}: {
  id: string;
  photoId: string;
  reactorId: string;
  reactorRole: UserRole;
}): Promise<{ created: boolean }> {
  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('group_id')
    .eq('id', photoId)
    .single();

  if (photoError) {
    throw new Error(getErrorMessage(photoError, '対象写真の取得に失敗しました。'));
  }

  // 以前はここで role を 'uncle' に固定していたが、孫も Good するようになったため
  // 呼び出し元の役割を使う。固定のままだと孫の users.role が上書きされてしまう。
  await ensureGroupAndUser({
    groupId: photo.group_id as string,
    userId: reactorId,
    role: reactorRole,
  });

  const { error } = await supabase.from('reactions').insert({
    id,
    photo_id: photoId,
    reactor_id: reactorId,
  });

  if (error) {
    if (error.code === '23505') {
      return { created: false };
    }
    throw new Error(getErrorMessage(error, 'リアクションの登録に失敗しました。'));
  }

  await updateLife({
    groupId: photo.group_id as string,
    userId: reactorId,
    actionType: 'reaction',
  });

  return { created: true };
}
