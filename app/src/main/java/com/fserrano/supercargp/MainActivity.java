package com.fserrano.supercargp;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private WebView web;
    private SharedPreferences prefs;

    // Las actualizaciones del juego se descargan de aquí (repositorio público)
    private static final String BASE = "https://raw.githubusercontent.com/franciscoserranoadt/supercar-gt/main/app/src/main/assets/";
    private static final String[] FILES = { "index.html", "game.js" };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("supercargp", MODE_PRIVATE);

        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        w.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        hideBars();
        web.loadUrl(gameUrl());
        checkUpdate();
    }

    /* ---------- Actualización automática del juego ---------- */
    private File gameDir() { return new File(getFilesDir(), "juego"); }

    private int bundledVersion() {
        try (InputStream in = getAssets().open("version.txt")) {
            return Integer.parseInt(new String(readAll(in), StandardCharsets.UTF_8).trim());
        } catch (Exception e) { return 0; }
    }

    private int downloadedVersion() {
        File ok = new File(gameDir(), "version.txt");
        if (!ok.exists()) return 0;
        for (String f : FILES) if (!new File(gameDir(), f).exists()) return 0;
        try (InputStream in = new java.io.FileInputStream(ok)) {
            return Integer.parseInt(new String(readAll(in), StandardCharsets.UTF_8).trim());
        } catch (Exception e) { return 0; }
    }

    private int currentVersion() { return Math.max(bundledVersion(), downloadedVersion()); }

    private String gameUrl() {
        if (downloadedVersion() > bundledVersion()) return "file://" + new File(gameDir(), "index.html").getAbsolutePath();
        return "file:///android_asset/index.html";
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384]; int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static byte[] fetch(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "?t=" + System.currentTimeMillis()).openConnection();
        c.setConnectTimeout(8000); c.setReadTimeout(15000); c.setUseCaches(false);
        try {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream()) { return readAll(in); }
        } finally { c.disconnect(); }
    }

    private void checkUpdate() {
        new Thread(() -> {
            try {
                int remote = Integer.parseInt(new String(fetch(BASE + "version.txt"), StandardCharsets.UTF_8).trim());
                if (remote <= currentVersion()) return;
                File tmp = new File(getFilesDir(), "juego_nuevo");
                deleteDir(tmp); tmp.mkdirs();
                for (String f : FILES) {
                    byte[] data = fetch(BASE + f);
                    if (data.length < 200) return;  // descarga incompleta: no se toca nada
                    if (f.equals("game.js") && !new String(data, StandardCharsets.UTF_8).contains("buildTracks")) return;
                    try (FileOutputStream o = new FileOutputStream(new File(tmp, f))) { o.write(data); }
                }
                try (FileOutputStream o = new FileOutputStream(new File(tmp, "version.txt"))) { o.write(String.valueOf(remote).getBytes(StandardCharsets.UTF_8)); }
                File dir = gameDir();
                deleteDir(dir);
                if (!tmp.renameTo(dir)) return;
                runOnUiThread(() -> web.evaluateJavascript("window.onUpdateReady && window.onUpdateReady(" + remote + ");", null));
            } catch (Exception ignored) { }
        }).start();
    }

    private static void deleteDir(File d) {
        if (d == null || !d.exists()) return;
        File[] l = d.listFiles();
        if (l != null) for (File f : l) { if (f.isDirectory()) deleteDir(f); else f.delete(); }
        d.delete();
    }

    private void hideBars() {
        web.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onBack && window.onBack();", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.onAppPause && window.onAppPause();", null);
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.onAppResume && window.onAppResume();", null);
        hideBars();
    }

    private class Bridge {
        @JavascriptInterface
        public void save(String key, String value) {
            prefs.edit().putString(key, value).apply();
        }

        @JavascriptInterface
        public String load(String key) {
            return prefs.getString(key, "");
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null) return;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(ms);
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public int gameVersion() { return currentVersion(); }

        @JavascriptInterface
        public void reload() {
            runOnUiThread(() -> web.loadUrl(gameUrl()));
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(() -> finish());
        }
    }
}
