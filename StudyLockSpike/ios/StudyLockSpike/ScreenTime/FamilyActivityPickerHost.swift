import FamilyControls
import SwiftUI
import UIKit

@available(iOS 16.0, *)
final class FamilyActivityPickerHost {
  static func present(
    initialSelection: FamilyActivitySelection,
    completion: @escaping (Result<FamilyActivitySelection, Error>) -> Void
  ) {
    var selection = initialSelection
    var hostingController: UIHostingController<FamilyActivityPickerView>?

    let binding = Binding<FamilyActivitySelection>(
      get: { selection },
      set: { selection = $0 }
    )

    let view = FamilyActivityPickerView(
      selection: binding,
      onCancel: {
        hostingController?.dismiss(animated: true) {
          completion(.failure(PickerError.cancelled))
        }
      },
      onDone: {
        let pickedSelection = selection
        hostingController?.dismiss(animated: true) {
          completion(.success(pickedSelection))
        }
      }
    )

    hostingController = UIHostingController(rootView: view)
    hostingController?.modalPresentationStyle = .formSheet

    guard let presenter = topViewController() else {
      completion(.failure(PickerError.noPresenter))
      return
    }

    presenter.present(hostingController!, animated: true)
  }

  private static func topViewController() -> UIViewController? {
    guard let scene = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first(where: { $0.activationState == .foregroundActive }),
      let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
    else {
      return nil
    }

    var current = root
    while let presented = current.presentedViewController {
      current = presented
    }
    return current
  }
}

enum PickerError: LocalizedError {
  case cancelled
  case noPresenter

  var errorDescription: String? {
    switch self {
    case .cancelled:
      return "アプリ選択がキャンセルされました。"
    case .noPresenter:
      return "FamilyActivityPickerを表示する画面が見つかりません。"
    }
  }
}
