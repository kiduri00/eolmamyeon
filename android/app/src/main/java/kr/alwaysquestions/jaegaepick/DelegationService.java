package kr.alwaysquestions.jaegaepick;

import android.app.Notification;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.trusted.TrustedWebActivityCallbackRemote;

/**
 * Notification delegation for the TWA (web push from the site is shown as this app's notification).
 *
 * 1.0.0 jp3: Chrome passes its own generic channel name ("일반"/"General") for every delegated
 * notification. We replace it with one fixed name so Android settings show
 * "관심 구역·조건 소식" for the only channel this app has. The same name must be used in all three
 * places Chrome asks about the channel (permission check/request, enabled check, notify), otherwise
 * the permission would be checked against a different channel id than the one notifications use.
 *
 * Do not rename after the Play release: the channel id is derived from the name, so a new name makes a
 * new channel and the user's per-channel settings would not carry over.
 */
public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    static final String CHANNEL_NAME = "관심 구역·조건 소식";
    private static final String KEY_CHANNEL_NAME = "notificationChannelName";

    @Override
    public void onCreate() {
        super.onCreate();
    }

    @Override
    public boolean onNotifyNotificationWithChannel(@NonNull String platformTag, int platformId,
            @NonNull Notification notification, @NonNull String channelName) {
        return super.onNotifyNotificationWithChannel(platformTag, platformId, notification, CHANNEL_NAME);
    }

    @Override
    public boolean onAreNotificationsEnabled(@NonNull String channelName) {
        return super.onAreNotificationsEnabled(CHANNEL_NAME);
    }

    @Nullable
    @Override
    public Bundle onExtraCommand(@NonNull String commandName, @NonNull Bundle args,
            @Nullable TrustedWebActivityCallbackRemote callbackRemote) {
        // checkNotificationPermission / getNotificationPermissionRequestPendingIntent carry the channel name.
        Bundle a = new Bundle(args);
        if (a.containsKey(KEY_CHANNEL_NAME)) a.putString(KEY_CHANNEL_NAME, CHANNEL_NAME);
        return super.onExtraCommand(commandName, a, callbackRemote);
    }
}
