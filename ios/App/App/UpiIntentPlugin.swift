import Foundation
import Capacitor
import UIKit

@objc(UpiIntentPlugin)
public class UpiIntentPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "UpiIntentPlugin"
    public let jsName = "UpiIntent"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAvailableApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openUpiUrl", returnType: CAPPluginReturnPromise)
    ]

    /// One UPI app the app can hand a payment off to.
    /// - `id`      : stable key shared with the JS chooser UI.
    /// - `name`    : display name.
    /// - `scheme`  : the app's UNIQUE URL scheme used ONLY for install-detection
    ///               (never the generic `upi://`, which many apps claim and would
    ///               produce false positives). Must be whitelisted in Info.plist
    ///               LSApplicationQueriesSchemes.
    /// - `prefix`  : the app-specific deep-link prefix; the NPCI query is appended.
    private struct UpiApp {
        let id: String
        let name: String
        let scheme: String
        let prefix: String
    }

    private let catalog: [UpiApp] = [
        UpiApp(id: "gpay",      name: "Google Pay", scheme: "tez",        prefix: "tez://upi/pay?"),
        UpiApp(id: "phonepe",   name: "PhonePe",    scheme: "phonepe",    prefix: "phonepe://pay?"),
        UpiApp(id: "paytm",     name: "Paytm",      scheme: "paytmmp",    prefix: "paytmmp://pay?"),
        UpiApp(id: "cred",      name: "CRED",       scheme: "credpay",    prefix: "credpay://pay?"),
        UpiApp(id: "bhim",      name: "BHIM",       scheme: "bhim",       prefix: "bhim://pay?"),
        // Best-effort schemes — verify on a device that has these apps installed.
        // If a scheme is wrong the app simply won't be detected (won't show) — safe.
        UpiApp(id: "amazonpay",  name: "Amazon Pay",  scheme: "amazonpay",  prefix: "amazonpay://pay?"),
        UpiApp(id: "supermoney", name: "super.money", scheme: "supermoney", prefix: "supermoney://pay?"),
        UpiApp(id: "mobikwik",   name: "MobiKwik",    scheme: "mobikwik",   prefix: "mobikwik://pay?"),
        UpiApp(id: "freecharge", name: "Freecharge",  scheme: "freecharge", prefix: "freecharge://pay?"),
        UpiApp(id: "navi",       name: "Navi",        scheme: "navi",       prefix: "navi://pay?"),
        UpiApp(id: "groww",      name: "Groww",       scheme: "groww",      prefix: "groww://pay?")
    ]

    /// Extract the NPCI query (everything after the first "?") from a `upi://pay?…` link.
    private func query(from upiUrl: String) -> String {
        if let qIndex = upiUrl.firstIndex(of: "?") {
            return String(upiUrl[upiUrl.index(after: qIndex)...])
        }
        return ""
    }

    private func isInstalled(_ app: UpiApp) -> Bool {
        guard let url = URL(string: "\(app.scheme)://") else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    /// Return only the UPI apps actually installed on this device, so the JS chooser
    /// lists exactly what the user can pay with (no dead entries).
    @objc func getAvailableApps(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let installed = self.catalog.filter { self.isInstalled($0) }
            let apps = installed.map { ["id": $0.id, "name": $0.name] }
            NSLog("[UpiIntent] Available UPI apps: %d", installed.count)
            call.resolve(["apps": apps])
        }
    }

    /// Open a UPI payment. When `app` (a catalog id) is supplied the specific app is
    /// launched directly (used by the custom in-app chooser). Without `app`, the raw
    /// `upi://` link is opened as a fallback.
    @objc func openUpiUrl(_ call: CAPPluginCall) {
        guard let upiUrl = call.getString("url"), upiUrl.hasPrefix("upi://") else {
            call.reject("Invalid UPI URL")
            return
        }

        let q = query(from: upiUrl)
        let appId = call.getString("app")

        let target: URL?
        let appName: String
        if let appId = appId, let app = catalog.first(where: { $0.id == appId }) {
            target = URL(string: app.prefix + q)
            appName = app.name
        } else {
            target = URL(string: upiUrl)
            appName = "UPI app"
        }

        guard let url = target else {
            call.reject("Invalid UPI URL")
            return
        }

        NSLog("[UpiIntent] Opening %@ via %@", appName, url.absoluteString)

        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    NSLog("[UpiIntent] %@ opened successfully", appName)
                    call.resolve(["success": true])
                } else {
                    NSLog("[UpiIntent] Failed to open %@", appName)
                    call.reject("Could not open \(appName). Please try another UPI app.")
                }
            }
        }
    }
}
