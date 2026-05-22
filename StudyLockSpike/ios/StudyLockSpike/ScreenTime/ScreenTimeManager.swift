import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

@available(iOS 16.0, *)
final class ScreenTimeManager {
  static let shared = ScreenTimeManager()

  private let store = ManagedSettingsStore(named: ScreenTimeShared.storeName)
  private let activityCenter = DeviceActivityCenter()

  private init() {}

  func requestAuthorization() async throws -> Bool {
    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
    return AuthorizationCenter.shared.authorizationStatus == .approved
  }

  func authorizationStatus() -> String {
    switch AuthorizationCenter.shared.authorizationStatus {
    case .notDetermined:
      return "notDetermined"
    case .denied:
      return "denied"
    case .approved:
      return "approved"
    @unknown default:
      return "unknown"
    }
  }

  func saveSelection(_ selection: FamilyActivitySelection) throws {
    try ScreenTimeShared.saveSelection(selection)
  }

  func hasSelection() -> Bool {
    ScreenTimeShared.hasSelection()
  }

  func startImmediateShield() throws -> Bool {
    guard let selection = try ScreenTimeShared.loadSelection(), ScreenTimeShared.hasSelection() else {
      throw ScreenTimeError.noSelection
    }

    ScreenTimeShared.applyShield(selection, to: store)
    return true
  }

  func stopImmediateShield() -> Bool {
    ScreenTimeShared.clearShield(from: store)
    return true
  }

  func startScheduledShield(
    startHour: Int,
    startMinute: Int,
    endHour: Int,
    endMinute: Int
  ) throws -> Bool {
    guard ScreenTimeShared.hasSelection() else {
      throw ScreenTimeError.noSelection
    }

    try validateTime(hour: startHour, minute: startMinute)
    try validateTime(hour: endHour, minute: endMinute)

    let schedule = DeviceActivitySchedule(
      intervalStart: DateComponents(hour: startHour, minute: startMinute),
      intervalEnd: DateComponents(hour: endHour, minute: endMinute),
      repeats: true
    )

    activityCenter.stopMonitoring([ScreenTimeShared.activityName])
    try activityCenter.startMonitoring(ScreenTimeShared.activityName, during: schedule)
    return true
  }

  func stopScheduledShield() -> Bool {
    activityCenter.stopMonitoring([ScreenTimeShared.activityName])
    ScreenTimeShared.clearShield(from: store)
    return true
  }

  private func validateTime(hour: Int, minute: Int) throws {
    guard (0...23).contains(hour), (0...59).contains(minute) else {
      throw ScreenTimeError.invalidTime
    }
  }
}

enum ScreenTimeError: LocalizedError {
  case noSelection
  case invalidTime
  case unavailable

  var errorDescription: String? {
    switch self {
    case .noSelection:
      return "制限対象アプリが選択されていません。"
    case .invalidTime:
      return "時刻は hour: 0-23、minute: 0-59 の範囲で指定してください。"
    case .unavailable:
      return "Screen Time APIはiOS 16以降の実機で利用してください。"
    }
  }
}
