import { NativeModules, Platform } from 'react-native';

export type ScreenTimeAuthorizationStatus =
  | 'notDetermined'
  | 'denied'
  | 'approved'
  | 'unavailable'
  | 'unknown';

export type ScreenTimeModuleType = {
  requestAuthorization(): Promise<boolean>;
  getAuthorizationStatus(): Promise<ScreenTimeAuthorizationStatus>;
  presentFamilyActivityPicker(): Promise<boolean>;
  hasFamilyActivitySelection(): Promise<boolean>;
  startImmediateShield(): Promise<boolean>;
  stopImmediateShield(): Promise<boolean>;
  startScheduledShield(
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
  ): Promise<boolean>;
  stopScheduledShield(): Promise<boolean>;
};

const nativeModule = NativeModules.ScreenTimeModule as
  | ScreenTimeModuleType
  | undefined;

const unavailable = async () => {
  throw new Error('ScreenTimeModule is available only on the native iOS build.');
};

export const ScreenTimeModule: ScreenTimeModuleType =
  Platform.OS === 'ios' && nativeModule
    ? nativeModule
    : {
        requestAuthorization: unavailable,
        getAuthorizationStatus: async () => 'unavailable',
        presentFamilyActivityPicker: unavailable,
        hasFamilyActivitySelection: async () => false,
        startImmediateShield: unavailable,
        stopImmediateShield: unavailable,
        startScheduledShield: unavailable,
        stopScheduledShield: unavailable,
      };
