import DeviceActivity
import FamilyControls
import ManagedSettings

@available(iOS 16.0, *)
final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  private let store = ManagedSettingsStore(named: ScreenTimeShared.storeName)

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)

    guard activity == ScreenTimeShared.activityName,
      let selection = try? ScreenTimeShared.loadSelection()
    else {
      return
    }

    ScreenTimeShared.applyShield(selection, to: store)
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)

    guard activity == ScreenTimeShared.activityName else {
      return
    }

    ScreenTimeShared.clearShield(from: store)
  }
}
