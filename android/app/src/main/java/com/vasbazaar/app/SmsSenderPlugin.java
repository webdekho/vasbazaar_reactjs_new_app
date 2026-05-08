package com.vasbazaar.app;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "SmsSender",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.SEND_SMS }
        )
    }
)
public class SmsSenderPlugin extends Plugin {
    private static final String TAG = "SmsSenderPlugin";
    private static final String SMS_SENT_ACTION = "SMS_SENT";
    private static final String SMS_DELIVERED_ACTION = "SMS_DELIVERED";

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                == PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        // Request permission
        requestPermissionForAlias("sms", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED;

        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message");

        if (phoneNumber == null || phoneNumber.isEmpty()) {
            call.reject("Phone number is required");
            return;
        }

        if (message == null || message.isEmpty()) {
            call.reject("Message is required");
            return;
        }

        // Check permission first
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("SMS permission not granted");
            return;
        }

        try {
            SmsManager smsManager;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getContext().getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            // For long messages, split into parts
            ArrayList<String> parts = smsManager.divideMessage(message);

            if (parts.size() > 1) {
                // Send multipart message
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
            } else {
                // Send single message
                smsManager.sendTextMessage(phoneNumber, null, message, null, null);
            }

            Log.d(TAG, "SMS sent to: " + phoneNumber);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("phoneNumber", phoneNumber);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Failed to send SMS: " + e.getMessage());
            call.reject("Failed to send SMS: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendBatchSms(PluginCall call) {
        // Get the messages array from the call
        com.getcapacitor.JSArray messagesArray = call.getArray("messages");
        int delayMs = call.getInt("delayMs", 1000);

        if (messagesArray == null || messagesArray.length() == 0) {
            call.reject("Messages array is required");
            return;
        }

        // Check permission first
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("SMS permission not granted");
            return;
        }

        // Run in background thread
        new Thread(() -> {
            int sent = 0;
            int failed = 0;

            try {
                SmsManager smsManager;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    smsManager = getContext().getSystemService(SmsManager.class);
                } else {
                    smsManager = SmsManager.getDefault();
                }

                for (int i = 0; i < messagesArray.length(); i++) {
                    try {
                        JSObject msgObj = JSObject.fromJSONObject(messagesArray.getJSONObject(i));
                        String phoneNumber = msgObj.getString("phoneNumber");
                        String message = msgObj.getString("message");

                        if (phoneNumber != null && message != null) {
                            ArrayList<String> parts = smsManager.divideMessage(message);

                            if (parts.size() > 1) {
                                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
                            } else {
                                smsManager.sendTextMessage(phoneNumber, null, message, null, null);
                            }
                            sent++;
                            Log.d(TAG, "SMS sent to: " + phoneNumber);
                        } else {
                            failed++;
                        }

                        // Delay between messages
                        if (i < messagesArray.length() - 1 && delayMs > 0) {
                            Thread.sleep(delayMs);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to send SMS: " + e.getMessage());
                        failed++;
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Batch SMS error: " + e.getMessage());
            }

            final int sentCount = sent;
            final int failedCount = failed;

            // Return result on main thread
            getActivity().runOnUiThread(() -> {
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("sent", sentCount);
                result.put("failed", failedCount);
                result.put("total", messagesArray.length());
                call.resolve(result);
            });
        }).start();
    }

    /**
     * Schedule an SMS reminder to be sent at a specific time
     * Uses WorkManager for reliable background execution
     */
    @PluginMethod
    public void scheduleReminder(PluginCall call) {
        String customerId = call.getString("customerId");
        String customerName = call.getString("customerName");
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message");
        String timeStr = call.getString("time"); // Format: "HH:mm"
        String frequency = call.getString("frequency", "DAILY");

        if (phoneNumber == null || message == null || customerId == null) {
            call.reject("customerId, phoneNumber and message are required");
            return;
        }

        // Check permission
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("SMS permission not granted");
            return;
        }

        try {
            // Format phone number
            String formattedNumber = phoneNumber.replaceAll("[^0-9+]", "");
            if (!formattedNumber.startsWith("+")) {
                formattedNumber = "+91" + formattedNumber;
            }

            // Calculate delay until scheduled time
            long delayMillis = calculateDelayUntil(timeStr, frequency);

            if (delayMillis < 0) {
                call.reject("Invalid schedule time");
                return;
            }

            // Create work request
            Data inputData = new Data.Builder()
                    .putString(SmsReminderWorker.KEY_CUSTOMER_ID, customerId)
                    .putString(SmsReminderWorker.KEY_CUSTOMER_NAME, customerName)
                    .putString(SmsReminderWorker.KEY_PHONE_NUMBER, formattedNumber)
                    .putString(SmsReminderWorker.KEY_MESSAGE, message)
                    .build();

            String workName = "sms_reminder_" + customerId;

            OneTimeWorkRequest workRequest = new OneTimeWorkRequest.Builder(SmsReminderWorker.class)
                    .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
                    .setInputData(inputData)
                    .addTag("sms_reminder")
                    .addTag("customer_" + customerId)
                    .build();

            // Schedule work (replace existing for same customer)
            WorkManager.getInstance(getContext())
                    .enqueueUniqueWork(workName, ExistingWorkPolicy.REPLACE, workRequest);

            Log.d(TAG, "SMS reminder scheduled for " + customerName + " at " + timeStr + " (delay: " + delayMillis + "ms)");

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("customerId", customerId);
            result.put("scheduledIn", delayMillis);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule reminder: " + e.getMessage());
            call.reject("Failed to schedule: " + e.getMessage());
        }
    }

    /**
     * Schedule multiple SMS reminders
     */
    @PluginMethod
    public void scheduleBatchReminders(PluginCall call) {
        JSArray remindersArray = call.getArray("reminders");

        if (remindersArray == null || remindersArray.length() == 0) {
            call.reject("reminders array is required");
            return;
        }

        // Check permission
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("SMS permission not granted");
            return;
        }

        int scheduled = 0;
        int failed = 0;

        try {
            for (int i = 0; i < remindersArray.length(); i++) {
                try {
                    JSONObject reminder = remindersArray.getJSONObject(i);
                    String customerId = reminder.getString("customerId");
                    String customerName = reminder.optString("customerName", "Customer");
                    String phoneNumber = reminder.getString("phoneNumber");
                    String message = reminder.getString("message");
                    String timeStr = reminder.optString("time", "10:00");
                    String frequency = reminder.optString("frequency", "DAILY");

                    // Format phone number
                    String formattedNumber = phoneNumber.replaceAll("[^0-9+]", "");
                    if (!formattedNumber.startsWith("+")) {
                        formattedNumber = "+91" + formattedNumber;
                    }

                    long delayMillis = calculateDelayUntil(timeStr, frequency);

                    if (delayMillis > 0) {
                        Data inputData = new Data.Builder()
                                .putString(SmsReminderWorker.KEY_CUSTOMER_ID, customerId)
                                .putString(SmsReminderWorker.KEY_CUSTOMER_NAME, customerName)
                                .putString(SmsReminderWorker.KEY_PHONE_NUMBER, formattedNumber)
                                .putString(SmsReminderWorker.KEY_MESSAGE, message)
                                .build();

                        String workName = "sms_reminder_" + customerId;

                        OneTimeWorkRequest workRequest = new OneTimeWorkRequest.Builder(SmsReminderWorker.class)
                                .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
                                .setInputData(inputData)
                                .addTag("sms_reminder")
                                .addTag("customer_" + customerId)
                                .build();

                        WorkManager.getInstance(getContext())
                                .enqueueUniqueWork(workName, ExistingWorkPolicy.REPLACE, workRequest);

                        scheduled++;
                        Log.d(TAG, "Scheduled reminder for " + customerName);
                    } else {
                        failed++;
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to schedule reminder: " + e.getMessage());
                    failed++;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Batch schedule error: " + e.getMessage());
        }

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("scheduled", scheduled);
        result.put("failed", failed);
        result.put("total", remindersArray.length());
        call.resolve(result);
    }

    /**
     * Cancel a scheduled reminder
     */
    @PluginMethod
    public void cancelReminder(PluginCall call) {
        String customerId = call.getString("customerId");

        if (customerId == null) {
            call.reject("customerId is required");
            return;
        }

        try {
            String workName = "sms_reminder_" + customerId;
            WorkManager.getInstance(getContext()).cancelUniqueWork(workName);

            Log.d(TAG, "Cancelled reminder for customer: " + customerId);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("customerId", customerId);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to cancel: " + e.getMessage());
        }
    }

    /**
     * Cancel all scheduled reminders
     */
    @PluginMethod
    public void cancelAllReminders(PluginCall call) {
        try {
            WorkManager.getInstance(getContext()).cancelAllWorkByTag("sms_reminder");

            Log.d(TAG, "Cancelled all SMS reminders");

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to cancel: " + e.getMessage());
        }
    }

    /**
     * Calculate milliseconds until the next occurrence of given time
     */
    private long calculateDelayUntil(String timeStr, String frequency) {
        try {
            String[] parts = (timeStr != null ? timeStr : "10:00").split(":");
            int hour = Integer.parseInt(parts[0]);
            int minute = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;

            Calendar now = Calendar.getInstance();
            Calendar target = Calendar.getInstance();
            target.set(Calendar.HOUR_OF_DAY, hour);
            target.set(Calendar.MINUTE, minute);
            target.set(Calendar.SECOND, 0);
            target.set(Calendar.MILLISECOND, 0);

            // If time has passed today, schedule for tomorrow
            if (target.getTimeInMillis() <= now.getTimeInMillis()) {
                target.add(Calendar.DAY_OF_MONTH, 1);
            }

            // For weekly, adjust to next Monday if needed
            if ("WEEKLY".equalsIgnoreCase(frequency)) {
                int dayOfWeek = target.get(Calendar.DAY_OF_WEEK);
                if (dayOfWeek != Calendar.MONDAY) {
                    int daysUntilMonday = (Calendar.MONDAY - dayOfWeek + 7) % 7;
                    if (daysUntilMonday == 0) daysUntilMonday = 7;
                    target.add(Calendar.DAY_OF_MONTH, daysUntilMonday);
                }
            }

            return target.getTimeInMillis() - now.getTimeInMillis();
        } catch (Exception e) {
            Log.e(TAG, "Error calculating delay: " + e.getMessage());
            return -1;
        }
    }
}
