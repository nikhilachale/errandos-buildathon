package ai.errandos.overlay;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;

public final class MainActivity extends Activity {
    private static final int OVERLAY_PERMISSION_REQUEST = 41;
    private static final int MICROPHONE_PERMISSION_REQUEST = 42;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        ensureOverlay();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (Settings.canDrawOverlays(this)) {
            startOverlay();
        }
    }

    private void ensureOverlay() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                new String[]{Manifest.permission.RECORD_AUDIO},
                MICROPHONE_PERMISSION_REQUEST
            );
            return;
        }

        if (Settings.canDrawOverlays(this)) {
            startOverlay();
            return;
        }

        Intent permission = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getPackageName())
        );
        startActivityForResult(permission, OVERLAY_PERMISSION_REQUEST);
    }

    private void startOverlay() {
        Intent service = new Intent(this, OverlayService.class);
        startForegroundService(service);
        finish();
    }
}
