// Drop-in replacement for React Native's Alert.alert(title, message, buttons, options),
// backed by a themed in-app modal (AppAlertHost) instead of the native OS dialog.
// Import this AS `Alert` in place of react-native's Alert — no call sites change,
// only the import line does.
let _show = null;

export function registerAlertHandler(fn) {
  _show = fn;
}

function alert(title, message, buttons, options) {
  if (_show) {
    _show(title, message, buttons, options);
  } else if (__DEV__) {
    console.warn('[appAlert] Host not mounted yet — dropped alert:', title, message);
  }
}

export default { alert };
