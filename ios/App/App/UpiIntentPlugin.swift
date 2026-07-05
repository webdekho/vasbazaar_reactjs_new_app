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

        NSLog("[UpiIntent] Opening UPI URL: %@", upiUrl)

        guard let url = URL(string: upiUrl) else {
            NSLog("[UpiIntent] Invalid UPI URL")
            call.reject("Invalid UPI URL")
            return
        }

        DispatchQueue.main.async {
            // Check that a UPI app is installed/able to handle this URL BEFORE trying to
            // open it (iOS equivalent of Android's intent.resolveActivity() null check).
            // Requires the URL scheme to be declared in Info.plist LSApplicationQueriesSchemes.
            guard UIApplication.shared.canOpenURL(url) else {
                NSLog("[UpiIntent] No UPI app found to handle this URL")
                call.reject("No UPI app found. Please install GPay, PhonePe, or Paytm.")
                return
            }

            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    NSLog("[UpiIntent] UPI app opened successfully")
                    call.resolve(["success": true])
                } else {
                    NSLog("[UpiIntent] Failed to open UPI app")
                    call.reject("Failed to open UPI app")
                }
            }
        }
    }
}
