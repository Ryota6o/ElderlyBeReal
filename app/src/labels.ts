/**
 * 役割の表示名。
 *
 * - 作成／参加のときは、まだ名前が無いので「Senior」と出す
 * - それ以降の画面では、まごが入力したおじいの名前（group.elder_name）を出す。
 *   未入力なら「Senior」に戻す
 */
export const SENIOR_LABEL = 'Senior';
export const CHILD_LABEL = 'まご';

export function seniorName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : SENIOR_LABEL;
}
