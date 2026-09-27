import type { AlertButton } from 'react-native';

/**
 * Web 版の Alert。react-native-web の Alert.alert は何も表示しないので、
 * ブラウザの alert / confirm で代わりに出す。
 * 「キャンセル + 実行ボタン1つ」は confirm、それ以外は alert を出してから先頭のボタンを実行する。
 */
function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  const text = message ? `${title}\n\n${message}` : title;
  const cancel = buttons?.find((button) => button.style === 'cancel');
  const actions = buttons?.filter((button) => button.style !== 'cancel') ?? [];

  if (cancel && actions.length > 0) {
    if (window.confirm(text)) {
      actions[0].onPress?.();
    } else {
      cancel.onPress?.();
    }
    return;
  }

  window.alert(text);
  actions[0]?.onPress?.();
}

export const Alert = { alert };
