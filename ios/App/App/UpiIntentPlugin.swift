import Foundation
import Capacitor
import UIKit

@objc(UpiIntentPlugin)
public class UpiIntentPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "UpiIntentPlugin"
    public let jsName = "UpiIntent"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openUpiUrl", returnType: CAPPluginReturnPromise)
    ]

    @objc func openUpiUrl(_ call: CAPPluginCall) {
        guard let upiUrl = call.getString("url") else {
            call.reject("UPI URL is required")
            return
        }

        guard let url = URL(string: upiUrl) else {
            call.reject("Invalid UPI URL")
            return
        }

        DispatchQueue.main.async {
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:]) { success in
                    if success {
                        call.resolve(["success": true])
                    } else {
                        call.reject("Failed to open UPI app")
                    }
                }
            } else {
                call.reject("No UPI app found to handle this URL")
            }
        }
    }
}
