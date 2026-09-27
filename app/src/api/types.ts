export type UserRole = 'child' | 'uncle';

export interface Photo {
  id: string;
  group_id: string;
  uploader_id: string;
  image_url: string;
  created_at: string;
  uploader_role: UserRole | null;
  /** listPhotos に viewerId を渡した場合のみ意味を持つ。渡さなければ常に false。 */
  reacted: boolean;
}

export interface ListPhotosResponse {
  photos: Photo[];
}

export type LifeActionType = 'photo_upload' | 'reaction';

export interface LifeStatus {
  life_value: number;
  life_updated_at: string;
}

/** グループ一覧（参加画面）に出す最小限の情報。 */
export interface GroupSummary {
  id: string;
  elder_name: string | null;
  created_at: string;
}

/** おじいの名前・年齢・アイコン。孫が初回に入力し、DEAD 画面の「享年N歳」などに使う。 */
export interface ElderInfo {
  elder_name: string | null;
  elder_age: number | null;
  elder_icon_url: string | null;
}

/** 自分（users 行）のプロフィール。まごの名前・年齢は一度決めたら変更しない。 */
export interface SelfProfile {
  name: string;
  age: number | null;
  icon_url: string | null;
}

export interface GroupProfile {
  elder: ElderInfo;
  self: SelfProfile;
}

/** アイコンの対象。self = 自分、elder = おじい。 */
export type IconTarget = 'self' | 'elder';
