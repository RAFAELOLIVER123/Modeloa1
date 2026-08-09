package com.paf.gestaooperacional;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String START_URL = "https://salmon-woodcock-375027.hostingersite.com/";
    private static final String PREFS = "agrodominium_app";
    private static final String KEY_LAST_URL = "last_url";
    private static final int REQ_LOCATION = 1001;
    private static final int REQ_CAMERA = 1002;
    private static final int REQ_FILE = 1003;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private OfflineStore offlineStore;
    private String offlineScript;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.rgb(248, 250, 249));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        offlineStore = new OfflineStore(this);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(248, 250, 249));
        webView = new WebView(this);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);

        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, 7);
        root.addView(progressBar, pp);

        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.statusBars()
                            | WindowInsetsCompat.Type.navigationBars()
                            | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(0, bars.top, 0, bars.bottom);
            return windowInsets;
        });

        setContentView(root);
        ViewCompat.requestApplyInsets(root);

        configureWebView();
        requestBasePermissions();
        registerConnectivityMonitor();

        String firstUrl = getPreferencesStore().getString(KEY_LAST_URL, START_URL);
        updateCacheMode();
        webView.loadUrl(firstUrl == null || firstUrl.trim().isEmpty() ? START_URL : firstUrl);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
        settings.setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setOffscreenPreRaster(true);
        }
        settings.setUserAgentString(settings.getUserAgentString() + " AgroDominiumAndroid/1.1 OfflineFirst");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new OfflineBridge(), "AgroDominiumOffline");
        webView.setBackgroundColor(Color.rgb(248, 250, 249));

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    if (uri.getHost() != null && uri.getHost().endsWith("hostingersite.com")) {
                        return false;
                    }
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                    }
                    return true;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();

                if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) {
                    getPreferencesStore().edit().putString(KEY_LAST_URL, url).apply();
                }

                injectOfflineLayer();
                if (isOnline()) {
                    view.evaluateJavascript("window.AgroSyncNow && window.AgroSyncNow();", null);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame() && !isOnline()) {
                    loadOfflineFallback();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    geoOrigin = origin;
                    geoCallback = callback;
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                            REQ_LOCATION);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = filePathCallback;

                Intent contentIntent = fileChooserParams.createIntent();
                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentIntent.setType("*/*");
                contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

                Intent cameraIntent = null;
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED) {
                    cameraIntent = buildCameraIntent();
                }

                Intent chooser = Intent.createChooser(contentIntent, "Fotos e arquivos");
                if (cameraIntent != null) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }
                try {
                    startActivityForResult(chooser, REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this,
                            "Não foi possível abrir a câmera/arquivos.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception e) {
                Toast.makeText(this, "Não foi possível abrir o arquivo.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private SharedPreferences getPreferencesStore() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private void injectOfflineLayer() {
        try {
            if (offlineScript == null) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(
                        getAssets().open("agrodominium_offline.js"), StandardCharsets.UTF_8));
                StringBuilder builder = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    builder.append(line).append('\n');
                }
                reader.close();
                offlineScript = builder.toString();
            }
            webView.evaluateJavascript(offlineScript, null);
        } catch (Exception e) {
            Toast.makeText(this, "Camada offline indisponível nesta tela.", Toast.LENGTH_SHORT).show();
        }
    }

    private void loadOfflineFallback() {
        if (webView == null) {
            return;
        }
        String current = webView.getUrl();
        if (current != null && current.startsWith("file:///android_asset/offline.html")) {
            return;
        }
        webView.loadUrl("file:///android_asset/offline.html");
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) {
            return false;
        }
        Network network = cm.getActiveNetwork();
        if (network == null) {
            return false;
        }
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private void updateCacheMode() {
        if (webView == null) {
            return;
        }
        webView.getSettings().setCacheMode(
                isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
    }

    private void registerConnectivityMonitor() {
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return;
        }

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                runOnUiThread(() -> {
                    updateCacheMode();
                    if (webView == null) {
                        return;
                    }
                    String current = webView.getUrl();
                    if (current != null && current.startsWith("file:///android_asset/offline.html")) {
                        String last = getPreferencesStore().getString(KEY_LAST_URL, START_URL);
                        webView.loadUrl(last == null ? START_URL : last);
                    } else {
                        webView.evaluateJavascript("window.AgroSyncNow && window.AgroSyncNow();", null);
                    }
                });
            }

            @Override
            public void onLost(Network network) {
                runOnUiThread(() -> {
                    updateCacheMode();
                    if (webView != null) {
                        webView.evaluateJavascript("window.AgroOfflineStatus && window.AgroOfflineStatus();", null);
                    }
                });
            }
        };

        try {
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception ignored) {
        }
    }

    private void requestBasePermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                    REQ_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA},
                    REQ_CAMERA);
        }
    }

    private Intent buildCameraIntent() {
        try {
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File photo = File.createTempFile("agrodominium_", ".jpg", dir);
            cameraUri = FileProvider.getUriForFile(this,
                    getPackageName() + ".fileprovider", photo);
            Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return camera;
        } catch (IOException e) {
            cameraUri = null;
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) {
            return;
        }

        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data == null || (data.getData() == null && data.getClipData() == null)) {
                if (cameraUri != null) {
                    result = new Uri[]{cameraUri};
                }
            } else if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) {
                    result[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraUri = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_LOCATION && geoCallback != null) {
            boolean granted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
            geoCallback.invoke(geoOrigin, granted, false);
            geoCallback = null;
            geoOrigin = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
            }
        }
        if (offlineStore != null) {
            offlineStore.close();
        }
        if (webView != null) {
            webView.removeJavascriptInterface("AgroDominiumOffline");
            webView.destroy();
        }
        super.onDestroy();
    }

    private class OfflineBridge {
        @JavascriptInterface
        public boolean isOnline() {
            return MainActivity.this.isOnline();
        }

        @JavascriptInterface
        public long queue(String payload) {
            if (payload == null || payload.trim().isEmpty()) {
                return -1;
            }
            long id = offlineStore.add(payload);
            runOnUiThread(() -> Toast.makeText(MainActivity.this,
                    "Salvo no aparelho. Será sincronizado quando houver internet.",
                    Toast.LENGTH_SHORT).show());
            return id;
        }

        @JavascriptInterface
        public String getAll() {
            return offlineStore.getAll().toString();
        }

        @JavascriptInterface
        public void remove(long id) {
            offlineStore.remove(id);
        }

        @JavascriptInterface
        public int count() {
            return offlineStore.count();
        }

        @JavascriptInterface
        public void toast(String text) {
            if (text == null || text.trim().isEmpty()) {
                return;
            }
            runOnUiThread(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void openOnline() {
            runOnUiThread(() -> {
                String last = getPreferencesStore().getString(KEY_LAST_URL, START_URL);
                updateCacheMode();
                webView.loadUrl(last == null ? START_URL : last);
            });
        }
    }

    private static class OfflineStore extends SQLiteOpenHelper {
        private static final String DB_NAME = "agrodominium_offline.db";
        private static final int DB_VERSION = 1;
        private static final String TABLE = "sync_queue";

        OfflineStore(Context context) {
            super(context, DB_NAME, null, DB_VERSION);
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE " + TABLE + " (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "payload TEXT NOT NULL," +
                    "created_at INTEGER NOT NULL)");
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        }

        synchronized long add(String payload) {
            ContentValues values = new ContentValues();
            values.put("payload", payload);
            values.put("created_at", System.currentTimeMillis());
            return getWritableDatabase().insert(TABLE, null, values);
        }

        synchronized JSONArray getAll() {
            JSONArray array = new JSONArray();
            Cursor cursor = getReadableDatabase().query(TABLE,
                    new String[]{"id", "payload", "created_at"},
                    null, null, null, null, "id ASC");
            try {
                while (cursor.moveToNext()) {
                    JSONObject item = new JSONObject();
                    item.put("id", cursor.getLong(0));
                    item.put("payload", cursor.getString(1));
                    item.put("createdAt", cursor.getLong(2));
                    array.put(item);
                }
            } catch (Exception ignored) {
            } finally {
                cursor.close();
            }
            return array;
        }

        synchronized void remove(long id) {
            getWritableDatabase().delete(TABLE, "id = ?", new String[]{String.valueOf(id)});
        }

        synchronized int count() {
            Cursor cursor = getReadableDatabase().rawQuery(
                    "SELECT COUNT(*) FROM " + TABLE, null);
            try {
                return cursor.moveToFirst() ? cursor.getInt(0) : 0;
            } finally {
                cursor.close();
            }
        }
    }
}
