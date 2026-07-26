import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ADB_PATH = process.env.ADB_PATH
  ?? '/Users/suraj/Library/Android/sdk/platform-tools/adb';
const DEVICE_UDID = process.env.ANDROID_DEVICE_UDID ?? '55221VDAQ000J1';
const OVERLAY_PACKAGE = 'ai.errandos.overlay';
const OVERLAY_ACTION = 'ai.errandos.overlay.STATUS';

export type OverlayState =
  | 'working'
  | 'searching'
  | 'adding'
  | 'success'
  | 'clarification'
  | 'error'
  | 'ready';

export async function publishOverlayStatus(
  message: string,
  state: OverlayState,
): Promise<boolean> {
  try {
    await execFileAsync(ADB_PATH, [
      '-s',
      DEVICE_UDID,
      'shell',
      'am',
      'broadcast',
      '-a',
      OVERLAY_ACTION,
      '-p',
      OVERLAY_PACKAGE,
      '--es',
      'message',
      message,
      '--es',
      'state',
      state,
    ], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
