const koffi = require('koffi');

let user32;
let SetCursorPos, mouse_event, keybd_event, GetSystemMetrics, GetKeyState;

const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
const MOUSEEVENTF_MIDDLEUP = 0x0040;
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_HWHEEL = 0x1000;

const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_EXTENDEDKEY = 0x0001;

// Map web key codes to Windows virtual key codes
const KEY_MAP = {
  'KeyA': 0x41, 'KeyB': 0x42, 'KeyC': 0x43, 'KeyD': 0x44, 'KeyE': 0x45,
  'KeyF': 0x46, 'KeyG': 0x47, 'KeyH': 0x48, 'KeyI': 0x49, 'KeyJ': 0x4A,
  'KeyK': 0x4B, 'KeyL': 0x4C, 'KeyM': 0x4D, 'KeyN': 0x4E, 'KeyO': 0x4F,
  'KeyP': 0x50, 'KeyQ': 0x51, 'KeyR': 0x52, 'KeyS': 0x53, 'KeyT': 0x54,
  'KeyU': 0x55, 'KeyV': 0x56, 'KeyW': 0x57, 'KeyX': 0x58, 'KeyY': 0x59,
  'KeyZ': 0x5A,
  'Digit0': 0x30, 'Digit1': 0x31, 'Digit2': 0x32, 'Digit3': 0x33,
  'Digit4': 0x34, 'Digit5': 0x35, 'Digit6': 0x36, 'Digit7': 0x37,
  'Digit8': 0x38, 'Digit9': 0x39,
  'Numpad0': 0x60, 'Numpad1': 0x61, 'Numpad2': 0x62, 'Numpad3': 0x63,
  'Numpad4': 0x64, 'Numpad5': 0x65, 'Numpad6': 0x66, 'Numpad7': 0x67,
  'Numpad8': 0x68, 'Numpad9': 0x69,
  'NumpadMultiply': 0x6A, 'NumpadAdd': 0x6B, 'NumpadSubtract': 0x6D,
  'NumpadDecimal': 0x6E, 'NumpadDivide': 0x6F,
  'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74,
  'F6': 0x75, 'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79,
  'F11': 0x7A, 'F12': 0x7B,
  'Backspace': 0x08, 'Tab': 0x09, 'Enter': 0x0D, 'NumpadEnter': 0x0D,
  'ShiftLeft': 0x10, 'ShiftRight': 0x10, 'ControlLeft': 0x11, 'ControlRight': 0x11,
  'AltLeft': 0x12, 'AltRight': 0x12, 'MetaLeft': 0x5B, 'MetaRight': 0x5C,
  'Pause': 0x13, 'CapsLock': 0x14, 'Escape': 0x1B,
  'Space': 0x20, 'PageUp': 0x21, 'PageDown': 0x22,
  'End': 0x23, 'Home': 0x24,
  'ArrowLeft': 0x25, 'ArrowUp': 0x26, 'ArrowRight': 0x27, 'ArrowDown': 0x28,
  'PrintScreen': 0x2C, 'Insert': 0x2D, 'Delete': 0x2E,
  'ScrollLock': 0x91, 'NumLock': 0x90,
  'Semicolon': 0xBA, 'Equal': 0xBB, 'Comma': 0xBC, 'Minus': 0xBD,
  'Period': 0xBE, 'Slash': 0xBF, 'Backquote': 0xC0,
  'BracketLeft': 0xDB, 'Backslash': 0xDC, 'BracketRight': 0xDD,
  'Quote': 0xDE, 'ContextMenu': 0x5D,
};

// Extended keys that need KEYEVENTF_EXTENDEDKEY flag
const EXTENDED_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown',
  'NumpadEnter', 'ControlRight', 'AltRight', 'MetaLeft', 'MetaRight',
  'PrintScreen', 'ContextMenu',
]);

function init() {
  try {
    user32 = koffi.load('user32.dll');
    SetCursorPos = user32.func('bool SetCursorPos(int x, int y)');
    mouse_event = user32.func('void mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, int32 dwData, uintptr dwExtraInfo)');
    keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)');
    GetSystemMetrics = user32.func('int GetSystemMetrics(int nIndex)');
    return true;
  } catch (err) {
    console.error('Failed to load user32.dll:', err);
    return false;
  }
}

function getScreenSize() {
  if (!GetSystemMetrics) return { width: 1920, height: 1080 };
  return {
    width: GetSystemMetrics(0),   // SM_CXSCREEN
    height: GetSystemMetrics(1),  // SM_CYSCREEN
  };
}

function moveMouse(normX, normY) {
  if (!SetCursorPos) return;
  const screen = getScreenSize();
  const x = Math.round(normX * screen.width);
  const y = Math.round(normY * screen.height);
  SetCursorPos(x, y);
}

function mouseClick(button, isDown) {
  if (!mouse_event) return;
  let flags;
  if (button === 0) flags = isDown ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
  else if (button === 1) flags = isDown ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
  else if (button === 2) flags = isDown ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
  else return;
  mouse_event(flags, 0, 0, 0, 0);
}

function mouseScroll(deltaX, deltaY) {
  if (!mouse_event) return;
  if (deltaY !== 0) {
    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, -deltaY * 120, 0);
  }
  if (deltaX !== 0) {
    mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, deltaX * 120, 0);
  }
}

function keyPress(keyCode, isDown) {
  if (!keybd_event) return;
  const vk = KEY_MAP[keyCode];
  if (vk === undefined) return;

  let flags = isDown ? 0 : KEYEVENTF_KEYUP;
  if (EXTENDED_KEYS.has(keyCode)) {
    flags |= KEYEVENTF_EXTENDEDKEY;
  }
  keybd_event(vk, 0, flags, 0);
}

function handleInputEvent(event) {
  switch (event.type) {
    case 'mouse-move':
      moveMouse(event.x, event.y);
      break;
    case 'mouse-down':
      moveMouse(event.x, event.y);
      mouseClick(event.button, true);
      break;
    case 'mouse-up':
      moveMouse(event.x, event.y);
      mouseClick(event.button, false);
      break;
    case 'mouse-scroll':
      mouseScroll(event.deltaX || 0, event.deltaY || 0);
      break;
    case 'key-down':
      keyPress(event.keyCode, true);
      break;
    case 'key-up':
      keyPress(event.keyCode, false);
      break;
  }
}

// Send Ctrl+Alt+Del (requires special handling on Windows)
function sendCtrlAltDel() {
  // Note: Ctrl+Alt+Del cannot be simulated in user mode on modern Windows
  // Instead we can send Ctrl+Shift+Esc to open Task Manager
  keyPress('ControlLeft', true);
  keyPress('ShiftLeft', true);
  keyPress('Escape', true);
  keyPress('Escape', false);
  keyPress('ShiftLeft', false);
  keyPress('ControlLeft', false);
}

module.exports = { init, handleInputEvent, getScreenSize, sendCtrlAltDel };
