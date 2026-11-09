package com.delukz.fruitymcloops;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Fruity McLoops — a plain WebView shell around the single-file
 * Web Audio app in assets/public/index.html.
 *
 * The critical piece is WebChromeClient.onShowFileChooser: without it,
 * the app's <input type="file"> elements (MP3 loader, project loader)
 * do nothing in a WebView. We bridge them to Android's file picker
 * (ACTION_GET_CONTENT) and hand the picked URIs back to the page.
 *
 * v2.1: the app can also record mic samples via getUserMedia. That needs
 * the RECORD_AUDIO manifest permission, the runtime permission grant
 * below, and WebChromeClient.onPermissionRequest granting
 * RESOURCE_AUDIO_CAPTURE to our own bundled page.
 */
public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int MIC_PERMISSION_REQUEST = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setSupportZoom(false);

        /* Ask for the mic up front so the sample recorder works first try. */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{ Manifest.permission.RECORD_AUDIO },
                    MIC_PERMISSION_REQUEST);
        }

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                /* Only our bundled page ever loads, so grant audio capture
                   when the OS-level permission is in place; deny otherwise
                   (the page then shows its own "mic denied" message). */
                boolean micGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                        || checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                                == PackageManager.PERMISSION_GRANTED;
                String[] wanted = request.getResources();
                boolean onlyAudio = wanted.length > 0;
                for (String r : wanted) {
                    if (!PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                        onlyAudio = false;
                    }
                }
                if (micGranted && onlyAudio) {
                    request.grant(wanted);
                } else {
                    request.deny();
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mimeTypeFor(params));

                boolean multiple = params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);

                try {
                    startActivityForResult(
                            Intent.createChooser(intent, "Choose a file"),
                            FILE_CHOOSER_REQUEST);
                } catch (android.content.ActivityNotFoundException e) {
                    filePathCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/public/index.html");
    }

    /**
     * Map the page's accept attribute to a MIME type ACTION_GET_CONTENT
     * understands. HTML accept lists like ".json,application/json" or
     * extension-only values are not valid single MIME types, so they
     * fall back to "*\/*" and the user can still pick the file.
     */
    private static String mimeTypeFor(WebChromeClient.FileChooserParams params) {
        if (params != null) {
            String[] accepts = params.getAcceptTypes();
            if (accepts != null) {
                for (String a : accepts) {
                    if (a == null) continue;
                    a = a.trim();
                    if (a.equals("audio/*") || a.startsWith("audio/")) return "audio/*";
                    if (a.contains("/") && !a.contains(",")) return a;
                }
            }
        }
        return "*/*";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) {
            return;
        }
        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                results = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) {
                    results[i] = clip.getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[]{ data.getData() };
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
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
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
