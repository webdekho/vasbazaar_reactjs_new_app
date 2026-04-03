package com.vasbazaar.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.phone.SmsRetriever;
import com.google.android.gms.auth.api.phone.SmsRetrieverClient;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Status;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "SmsRetriever")
public class SmsRetrieverPlugin extends Plugin {

    private static final String TAG = "SmsRetrieverPlugin";
    private static final String EVENT_OTP_RECEIVED = "otpReceived";
    private static final Pattern OTP_PATTERN = Pattern.compile("\\b(\\d{6})\\b");

    private BroadcastReceiver smsReceiver;

    @PluginMethod
    public void startListening(PluginCall call) {
        if (!isGmsAvailable()) {
            call.resolve(new JSObject().put("started", false).put("error", "Google Play Services not available"));
            return;
        }

        try {
            SmsRetrieverClient client = SmsRetriever.getClient(getActivity());
            client.startSmsRetriever()
                .addOnSuccessListener(aVoid -> {
                    registerSmsReceiver();
                    Log.d(TAG, "SMS Retriever started");
                    call.resolve(new JSObject().put("started", true));
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Failed to start SMS Retriever", e);
                    call.resolve(new JSObject().put("started", false).put("error", e.getMessage()));
                });
        } catch (Exception e) {
            Log.e(TAG, "Exception starting SMS Retriever", e);
            call.resolve(new JSObject().put("started", false).put("error", e.getMessage()));
        }
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        unregisterSmsReceiver();
        call.resolve(new JSObject().put("stopped", true));
    }

    @PluginMethod
    public void getAppHash(PluginCall call) {
        try {
            String hash = AppSignatureHelper.getAppHash(getContext());
            call.resolve(new JSObject().put("hash", hash != null ? hash : ""));
        } catch (Exception e) {
            Log.e(TAG, "Failed to get app hash", e);
            call.resolve(new JSObject().put("hash", "").put("error", e.getMessage()));
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        call.resolve(new JSObject().put("available", isGmsAvailable()));
    }

    private boolean isGmsAvailable() {
        return GoogleApiAvailability.getInstance()
                .isGooglePlayServicesAvailable(getContext()) == ConnectionResult.SUCCESS;
    }

    private void registerSmsReceiver() {
        unregisterSmsReceiver();

        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!SmsRetriever.SMS_RETRIEVED_ACTION.equals(intent.getAction())) return;

                Bundle extras = intent.getExtras();
                if (extras == null) return;

                Status status = (Status) extras.get(SmsRetriever.EXTRA_STATUS);
                if (status == null) return;

                if (status.getStatusCode() == CommonStatusCodes.SUCCESS) {
                    String message = (String) extras.get(SmsRetriever.EXTRA_SMS_MESSAGE);
                    if (message == null) return;

                    String otp = extractOtp(message);
                    Log.d(TAG, "OTP received: " + (otp != null ? "****" : "null"));

                    JSObject result = new JSObject();
                    result.put("otp", otp != null ? otp : "");
                    result.put("message", message);
                    notifyListeners(EVENT_OTP_RECEIVED, result);
                } else if (status.getStatusCode() == CommonStatusCodes.TIMEOUT) {
                    Log.d(TAG, "SMS Retriever timed out");
                }

                unregisterSmsReceiver();
            }
        };

        IntentFilter filter = new IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(smsReceiver, filter);
        }
    }

    private void unregisterSmsReceiver() {
        if (smsReceiver != null) {
            try {
                getContext().unregisterReceiver(smsReceiver);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered
            }
            smsReceiver = null;
        }
    }

    private String extractOtp(String message) {
        if (message == null) return null;
        Matcher matcher = OTP_PATTERN.matcher(message);
        return matcher.find() ? matcher.group(1) : null;
    }

    @Override
    protected void handleOnDestroy() {
        unregisterSmsReceiver();
        super.handleOnDestroy();
    }
}
