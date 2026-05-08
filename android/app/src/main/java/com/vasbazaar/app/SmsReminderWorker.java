package com.vasbazaar.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.ArrayList;

/**
 * Background worker that sends SMS reminders at scheduled time.
 * Uses Android WorkManager for reliable background execution.
 */
public class SmsReminderWorker extends Worker {
    private static final String TAG = "SmsReminderWorker";

    public static final String KEY_PHONE_NUMBER = "phone_number";
    public static final String KEY_MESSAGE = "message";
    public static final String KEY_CUSTOMER_ID = "customer_id";
    public static final String KEY_CUSTOMER_NAME = "customer_name";

    public SmsReminderWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        String phoneNumber = getInputData().getString(KEY_PHONE_NUMBER);
        String message = getInputData().getString(KEY_MESSAGE);
        String customerId = getInputData().getString(KEY_CUSTOMER_ID);
        String customerName = getInputData().getString(KEY_CUSTOMER_NAME);

        Log.d(TAG, "SmsReminderWorker started for customer: " + customerName);

        if (phoneNumber == null || phoneNumber.isEmpty()) {
            Log.e(TAG, "Phone number is empty");
            return Result.failure();
        }

        if (message == null || message.isEmpty()) {
            Log.e(TAG, "Message is empty");
            return Result.failure();
        }

        // Check SMS permission
        if (ContextCompat.checkSelfPermission(getApplicationContext(), Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "SMS permission not granted");
            return Result.failure(new Data.Builder()
                    .putString("error", "SMS permission not granted")
                    .build());
        }

        try {
            // Format phone number
            String formattedNumber = phoneNumber.replaceAll("[^0-9+]", "");
            if (!formattedNumber.startsWith("+")) {
                formattedNumber = "+91" + formattedNumber;
            }

            // Get SMS Manager
            SmsManager smsManager;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getApplicationContext().getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            // Split message if too long
            ArrayList<String> parts = smsManager.divideMessage(message);

            if (parts.size() > 1) {
                smsManager.sendMultipartTextMessage(formattedNumber, null, parts, null, null);
            } else {
                smsManager.sendTextMessage(formattedNumber, null, message, null, null);
            }

            Log.d(TAG, "SMS sent successfully to: " + formattedNumber + " for customer: " + customerName);

            return Result.success(new Data.Builder()
                    .putString("customer_id", customerId)
                    .putString("customer_name", customerName)
                    .putBoolean("sent", true)
                    .build());

        } catch (Exception e) {
            Log.e(TAG, "Failed to send SMS: " + e.getMessage(), e);
            return Result.failure(new Data.Builder()
                    .putString("error", e.getMessage())
                    .build());
        }
    }
}
