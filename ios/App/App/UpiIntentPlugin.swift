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

        // Build an ordered list of candidates instead of a single URL. Before 2026-07-20 this
        // was one app-specific URL with NO fallback: if `tez://upi/pay?…` failed to open, the
        // plugin rejected immediately with "Could not open Google Pay". Customers then paid
        // from a different UPI app while our screen sat on "Waiting for payment…", and some
        // paid twice. Every UPI app also handles the generic `upi://` link, so falling back to
        // it lets iOS present its own chooser rather than dead-ending the payment.
        var candidates: [URL] = []
        let appName: String
        if let appId = appId, let app = catalog.first(where: { $0.id == appId }) {
            appName = app.name
            if let u = makeURL(app.prefix + q) { candidates.append(u) }
            // Google Pay has shipped both `tez` (legacy) and `gpay` scheme registrations;
            // whichever one canOpenURL matched may not be the one that handles /upi/pay.
            if app.id == "gpay", let u = makeURL("gpay://upi/pay?" + q) { candidates.append(u) }
        } else {
            appName = "UPI app"
        }
        // Generic NPCI link, always last — the universal fallback.
        if let u = makeURL(upiUrl) { candidates.append(u) }

        if candidates.isEmpty {
            call.reject("Invalid UPI URL")
            return
        }

        DispatchQueue.main.async {
            self.openFirstAvailable(candidates, appName: appName, call: call)
        }
    }

    /// Percent-encode before constructing the URL. The NPCI query carries a merchant name
    /// (`pn=VAS PAYMENT SOLUTIONS…`) whose spaces make `URL(string:)` return nil on older
    /// iOS, which surfaced as a bare "Invalid UPI URL".
    private func makeURL(_ raw: String) -> URL? {
        if let url = URL(string: raw) { return url }
        guard let encoded = raw.addingPercentEncoding(
            withAllowedCharacters: .urlQueryAllowed.union(CharacterSet(charactersIn: "#"))
        ) else { return nil }
        return URL(string: encoded)
    }

    /// Try each candidate in order; resolve on the first that opens, reject only if all fail.
    private func openFirstAvailable(_ urls: [URL], appName: String, call: CAPPluginCall) {
        guard let url = urls.first else {
            NSLog("[UpiIntent] All candidates failed for %@", appName)
            call.reject("Could not open \(appName). Please try another UPI app.")
            return
        }
        let rest = Array(urls.dropFirst())
        NSLog("[UpiIntent] Opening %@ via %@", appName, url.absoluteString)
        UIApplication.shared.open(url, options: [:]) { success in
            if success {
                NSLog("[UpiIntent] %@ opened successfully", appName)
                call.resolve(["success": true])
            } else {
                NSLog("[UpiIntent] Failed to open %@ — trying %d fallback(s)", url.absoluteString, rest.count)
                self.openFirstAvailable(rest, appName: appName, call: call)
            }
        }
    }
}
