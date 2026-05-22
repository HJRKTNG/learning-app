import ManagedSettings
import ManagedSettingsUI
import UIKit

@available(iOS 16.0, *)
final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  override func configuration(shielding application: Application) -> ShieldConfiguration {
    configuration()
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    configuration()
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    configuration()
  }

  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
    configuration()
  }

  private func configuration() -> ShieldConfiguration {
    ShieldConfiguration(
      backgroundBlurStyle: .systemMaterial,
      backgroundColor: .systemBackground,
      icon: nil,
      title: ShieldConfiguration.Label(text: "今は勉強時間です", color: .label),
      subtitle: ShieldConfiguration.Label(text: "宿題が終わったらアプリを使えるようになります", color: .secondaryLabel),
      primaryButtonLabel: ShieldConfiguration.Label(text: "閉じる", color: .white),
      primaryButtonBackgroundColor: .systemBlue
    )
  }
}
