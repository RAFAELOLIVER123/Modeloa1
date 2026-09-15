package com.damacub.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends Activity {
    private WebView webView;
    private RewardedAd rewardedAd;
    private ConsentInformation consentInformation;
    private final AtomicBoolean adsInitialized = new AtomicBoolean(false);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(11, 16, 32));
        getWindow().setNavigationBarColor(Color.rgb(11, 16, 32));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(11, 16, 32));
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new AdsBridge(), "AndroidAds");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/game.html");

        setupConsentAndAds();
    }

    private void setupConsentAndAds() {
        consentInformation = UserMessagingPlatform.getConsentInformation(this);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consentInformation.requestConsentInfoUpdate(
                this,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                        this,
                        formError -> {
                            notifyPrivacyRequirement();
                            if (consentInformation.canRequestAds()) initializeAds();
                        }),
                requestError -> {
                    notifyPrivacyRequirement();
                    if (consentInformation.canRequestAds()) initializeAds();
                });

        if (consentInformation.canRequestAds()) initializeAds();
    }

    private void initializeAds() {
        if (!adsInitialized.compareAndSet(false, true)) return;
        MobileAds.initialize(this, initializationStatus -> loadRewarded());
    }

    private void loadRewarded() {
        runOnUiThread(() -> {
            rewardedAd = null;
            notifyAdState(false);
            AdRequest request = new AdRequest.Builder().build();
            RewardedAd.load(
                    MainActivity.this,
                    BuildConfig.REWARDED_AD_UNIT_ID,
                    request,
                    new RewardedAdLoadCallback() {
                        @Override
                        public void onAdLoaded(RewardedAd ad) {
                            rewardedAd = ad;
                            rewardedAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                                @Override
                                public void onAdDismissedFullScreenContent() {
                                    rewardedAd = null;
                                    callJs("window.DamaCubAds&&DamaCubAds.onAdClosed() ");
                                    loadRewarded();
                                }

                                @Override
                                public void onAdFailedToShowFullScreenContent(AdError adError) {
                                    rewardedAd = null;
                                    callJs("window.DamaCubAds&&DamaCubAds.onAdUnavailable() ");
                                    loadRewarded();
                                }
                            });
                            notifyAdState(true);
                        }

                        @Override
                        public void onAdFailedToLoad(LoadAdError loadAdError) {
                            rewardedAd = null;
                            notifyAdState(false);
                            mainHandler.postDelayed(MainActivity.this::loadRewarded, 30000L);
                        }
                    });
        });
    }

    private void showRewardedInternal() {
        runOnUiThread(() -> {
            if (rewardedAd == null) {
                callJs("window.DamaCubAds&&DamaCubAds.onAdUnavailable() ");
                loadRewarded();
                return;
            }
            RewardedAd ad = rewardedAd;
            rewardedAd = null;
            notifyAdState(false);
            ad.show(MainActivity.this, rewardItem ->
                    callJs("window.DamaCubAds&&DamaCubAds.onRewardEarned()"));
        });
    }

    private void notifyAdState(boolean ready) {
        callJs("window.DamaCubAds&&DamaCubAds.onAdState(" + (ready ? "true" : "false") + ")");
    }

    private void notifyPrivacyRequirement() {
        if (consentInformation == null) return;
        boolean required = consentInformation.getPrivacyOptionsRequirementStatus()
                == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
        callJs("window.DamaCubAds&&DamaCubAds.onPrivacyRequired(" + (required ? "true" : "false") + ")");
    }

    private void showPrivacyOptionsInternal() {
        runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(
                MainActivity.this,
                formError -> {
                    notifyPrivacyRequirement();
                    if (consentInformation != null && consentInformation.canRequestAds()) initializeAds();
                }));
    }

    private void callJs(String script) {
        if (webView == null) return;
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    public class AdsBridge {
        @JavascriptInterface
        public void showRewarded() {
            showRewardedInternal();
        }

        @JavascriptInterface
        public void showPrivacyOptions() {
            showPrivacyOptionsInternal();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "(window.DamaCubBack&&DamaCubBack())?'1':'0'",
                value -> {
                    if (!"\"1\"".equals(value)) finishBack();
                });
    }

    private void finishBack() {
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidAds");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
