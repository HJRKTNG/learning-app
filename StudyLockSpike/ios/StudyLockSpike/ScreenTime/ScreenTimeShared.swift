import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

@available(iOS 16.0, *)
enum ScreenTimeShared {
  static let appGroupID = "group.com.studylockspike.screentime"
  static let selectionKey = "StudyLockSpikeFamilyActivitySelection"
  static let storeName = ManagedSettingsStore.Name("StudyLockSpikeStore")
  static let activityName = DeviceActivityName("StudyLockSpikeSchedule")

  static var defaults: UserDefaults {
    UserDefaults(suiteName: appGroupID) ?? .standard
  }

  static func saveSelection(_ selection: FamilyActivitySelection) throws {
    let data = try PropertyListEncoder().encode(selection)
    defaults.set(data, forKey: selectionKey)
  }

  static func loadSelection() throws -> FamilyActivitySelection? {
    guard let data = defaults.data(forKey: selectionKey) else {
      return nil
    }

    return try PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  static func hasSelection() -> Bool {
    guard let selection = try? loadSelection() else {
      return false
    }

    return !selection.applicationTokens.isEmpty ||
      !selection.categoryTokens.isEmpty ||
      !selection.webDomainTokens.isEmpty
  }

  static func applyShield(_ selection: FamilyActivitySelection, to store: ManagedSettingsStore) {
    store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
  }

  static func clearShield(from store: ManagedSettingsStore) {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
  }
}
