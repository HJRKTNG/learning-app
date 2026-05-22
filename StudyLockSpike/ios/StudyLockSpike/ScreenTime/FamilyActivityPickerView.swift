import FamilyControls
import SwiftUI

@available(iOS 16.0, *)
struct FamilyActivityPickerView: View {
  @Binding var selection: FamilyActivitySelection
  let onCancel: () -> Void
  let onDone: () -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("制限するアプリ")
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("キャンセル", action: onCancel)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("完了", action: onDone)
          }
        }
    }
  }
}
