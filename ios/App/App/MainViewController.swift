import UIKit
import Capacitor

/// Custom Capacitor bridge view controller.
///
/// App-embedded plugins (Swift files compiled directly into the App target, not
/// shipped as a Capacitor package) are NOT auto-discovered by the Capacitor 8
/// runtime. They must be registered explicitly here via `registerPluginInstance`
/// inside `capacitorDidLoad()`. Without this, `UpiIntent.openUpiUrl()` rejects
/// with "UpiIntent plugin is not implemented on ios".
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(UpiIntentPlugin())
    }
}
