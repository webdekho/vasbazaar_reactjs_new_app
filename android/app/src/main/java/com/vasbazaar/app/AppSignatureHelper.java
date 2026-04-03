package com.vasbazaar.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.util.Base64;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

/**
 * Computes the 11-character app hash required by the SMS Retriever API.
 * The backend must append this hash to OTP SMS messages for auto-detection.
 */
public class AppSignatureHelper {

    private static final String TAG = "AppSignatureHelper";
    private static final String HASH_TYPE = "SHA-256";
    private static final int NUM_HASHED_BYTES = 9;
    private static final int NUM_BASE64_CHAR = 11;

    public static String getAppHash(Context context) {
        try {
            String packageName = context.getPackageName();
            Signature[] signatures;

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                signatures = context.getPackageManager()
                        .getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                        .signingInfo.getApkContentsSigners();
            } else {
                signatures = context.getPackageManager()
                        .getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
                        .signatures;
            }

            if (signatures == null || signatures.length == 0) return null;

            String hashInput = packageName + " " + signatures[0].toCharsString();
            MessageDigest md = MessageDigest.getInstance(HASH_TYPE);
            byte[] hashBytes = md.digest(hashInput.getBytes(StandardCharsets.UTF_8));
            hashBytes = Arrays.copyOfRange(hashBytes, 0, NUM_HASHED_BYTES);
            String base64Hash = Base64.encodeToString(hashBytes, Base64.NO_PADDING | Base64.NO_WRAP);
            base64Hash = base64Hash.substring(0, NUM_BASE64_CHAR);

            Log.d(TAG, "App hash: " + base64Hash);
            return base64Hash;
        } catch (Exception e) {
            Log.e(TAG, "Failed to compute app hash", e);
            return null;
        }
    }
}
