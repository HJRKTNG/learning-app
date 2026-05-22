import FamilyControls
import Foundation
import React

@objc(ScreenTimeModule)
final class ScreenTimeModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable", ScreenTimeError.unavailable.localizedDescription, nil)
      return
    }

    Task {
      do {
        let approved = try await ScreenTimeManager.shared.requestAuthorization()
        resolve(approved)
      } catch {
        reject("screen_time_authorization_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(getAuthorizationStatus:rejecter:)
  func getAuthorizationStatus(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve("unavailable")
      return
    }

    resolve(ScreenTimeManager.shared.authorizationStatus())
  }

  @objc(presentFamilyActivityPicker:rejecter:)
  func presentFamilyActivityPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable", ScreenTimeError.unavailable.localizedDescription, nil)
      return
    }

    DispatchQueue.main.async {
      let existingSelection = (try? ScreenTimeShared.loadSelection()) ?? FamilyActivitySelection()
      FamilyActivityPickerHost.present(initialSelection: existingSelection) { result in
        do {
          let selection = try result.get()
          try ScreenTimeManager.shared.saveSelection(selection)
          resolve(ScreenTimeShared.hasSelection())
        } catch {
          reject("screen_time_picker_failed", error.localizedDescription, error)
        }
      }
    }
  }

  @objc(hasFamilyActivitySelection:rejecter:)
  func hasFamilyActivitySelection(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(false)
      return
    }

    resolve(ScreenTimeManager.shared.hasSelection())
  }

  @objc(startImmediateShield:rejecter:)
  func startImmediateShield(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable", ScreenTimeError.unavailable.localizedDescription, nil)
      return
    }

    do {
      resolve(try ScreenTimeManager.shared.startImmediateShield())
    } catch {
      reject("screen_time_immediate_shield_failed", error.localizedDescription, error)
    }
  }

  @objc(stopImmediateShield:rejecter:)
  func stopImmediateShield(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(false)
      return
    }

    resolve(ScreenTimeManager.shared.stopImmediateShield())
  }

  @objc(startScheduledShield:startMinute:endHour:endMinute:resolver:rejecter:)
  func startScheduledShield(
    _ startHour: NSNumber,
    startMinute: NSNumber,
    endHour: NSNumber,
    endMinute: NSNumber,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("screen_time_unavailable", ScreenTimeError.unavailable.localizedDescription, nil)
      return
    }

    do {
      let didStart = try ScreenTimeManager.shared.startScheduledShield(
        startHour: startHour.intValue,
        startMinute: startMinute.intValue,
        endHour: endHour.intValue,
        endMinute: endMinute.intValue
      )
      resolve(didStart)
    } catch {
      reject("screen_time_schedule_failed", error.localizedDescription, error)
    }
  }

  @objc(stopScheduledShield:rejecter:)
  func stopScheduledShield(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(false)
      return
    }

    resolve(ScreenTimeManager.shared.stopScheduledShield())
  }
}
