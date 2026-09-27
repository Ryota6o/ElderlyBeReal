import { countMembers, getGroupProfile } from '../api/client';
import type { UserRole } from '../api/types';

/**
 * 作成／参加のあとに進む画面（UI フロー図の分岐）。
 *
 * - まご: 自分の名前・年齢、またはおじいの名前・年齢が未登録ならプロフィール設定へ、
 *         揃っていれば Home
 * - おじ: まごがまだ入っていなければ待機画面へ、入っていれば Home
 */
export type PostJoinRoute = 'Home' | 'ProfileSetup' | 'Waiting';

export async function resolvePostJoinRoute({
  groupId,
  userId,
  role,
}: {
  groupId: string;
  userId: string;
  role: UserRole;
}): Promise<PostJoinRoute> {
  if (role === 'child') {
    const { elder, self } = await getGroupProfile({ groupId, userId });
    const elderReady = Boolean(elder.elder_name) && elder.elder_age !== null;
    const selfReady = self.age !== null;
    return elderReady && selfReady ? 'Home' : 'ProfileSetup';
  }

  const childCount = await countMembers(groupId, 'child');
  return childCount > 0 ? 'Home' : 'Waiting';
}
