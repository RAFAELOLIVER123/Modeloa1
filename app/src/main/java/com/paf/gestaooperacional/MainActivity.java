package com.paf.gestaooperacional;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
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
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONObject;

import java.io.File;
import java.io.IOException;

public class MainActivity extends Activity {
    private static final String LOCAL_URL="file:///android_asset/app/index.html";
    private static final String SITE="https://salmon-woodcock-375027.hostingersite.com/";
    private static final int REQ_LOCATION=1001,REQ_CAMERA=1002,REQ_FILE=1003,REQ_NOTIFY=1004;
    private WebView webView;private ProgressBar progressBar;private ValueCallback<Uri[]> fileCallback;private Uri cameraUri;private GeolocationPermissions.Callback geoCallback;private String geoOrigin;private FrameLayout root;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);WindowCompat.setDecorFitsSystemWindows(getWindow(),false);getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        root=new FrameLayout(this);root.setBackgroundColor(android.graphics.Color.rgb(244,248,245));webView=new WebView(this);progressBar=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        root.addView(webView,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));FrameLayout.LayoutParams pp=new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,6);root.addView(progressBar,pp);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});ViewCompat.requestApplyInsets(root);
        WindowInsetsControllerCompat ctl=new WindowInsetsControllerCompat(getWindow(),root);ctl.setAppearanceLightStatusBars(true);ctl.setAppearanceLightNavigationBars(true);
        configureWebView();requestBasePermissions();webView.loadUrl(LOCAL_URL);SyncScheduler.schedule(this);
        String active=OfflineDb.get(this).getActiveRouteUuid();if(active!=null&&hasLocationPermission()){Intent i=new Intent(this,LocationTrackingService.class);i.setAction(LocationTrackingService.ACTION_START);i.putExtra("route_uuid",active);ContextCompat.startForegroundService(this,i);}
    }

    private void configureWebView(){
        WebSettings s=webView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setGeolocationEnabled(true);s.setAllowFileAccess(true);s.setAllowContentAccess(true);s.setMediaPlaybackRequiresUserGesture(false);s.setSupportZoom(false);s.setBuiltInZoomControls(false);s.setTextZoom(100);s.setUserAgentString(s.getUserAgentString()+" AgroDominiumAndroid/2.0");
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(webView,true);webView.addJavascriptInterface(new AgroBridge(this),"AgroNative");
        webView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest req){Uri uri=req.getUrl();String scheme=uri.getScheme();if("file".equalsIgnoreCase(scheme))return false;if(("http".equalsIgnoreCase(scheme)||"https".equalsIgnoreCase(scheme))&&uri.getHost()!=null&&uri.getHost().endsWith("hostingersite.com")){return false;}try{startActivity(new Intent(Intent.ACTION_VIEW,uri));return true;}catch(Exception e){return false;}}
            @Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();if(url.startsWith(LOCAL_URL))evalJs("window.agroNetworkChanged && window.agroNetworkChanged("+ApiClient.isOnline(MainActivity.this)+");");}
        });
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int p){progressBar.setProgress(p);progressBar.setVisibility(p>=100?View.GONE:View.VISIBLE);}
            @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback cb){if(hasLocationPermission())cb.invoke(origin,true,false);else{geoOrigin=origin;geoCallback=cb;requestLocationPermission();}}
            @Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> cb,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;Intent content=params.createIntent();content.addCategory(Intent.CATEGORY_OPENABLE);content.setType("image/*");content.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);Intent camera=null;if(ContextCompat.checkSelfPermission(MainActivity.this,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)camera=buildCameraIntent();Intent chooser=Intent.createChooser(content,"Fotos");if(camera!=null)chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,new Intent[]{camera});try{startActivityForResult(chooser,REQ_FILE);return true;}catch(Exception e){fileCallback=null;Toast.makeText(MainActivity.this,"Não foi possível abrir fotos/câmera.",Toast.LENGTH_LONG).show();return false;}}
        });
        webView.setDownloadListener((url,ua,cd,mime,len)->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){Toast.makeText(this,"Não foi possível abrir o arquivo.",Toast.LENGTH_SHORT).show();}});
    }

    public void evalJs(String js){if(webView!=null)webView.evaluateJavascript(js,null);}
    public boolean hasLocationPermission(){return ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
    public void requestLocationPermission(){ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},REQ_LOCATION);}

    public void requestSingleLocation(String tag){
        if(!hasLocationPermission()){requestLocationPermission();locationCallback(tag,null,"Permissão de localização necessária.");return;}LocationManager lm=(LocationManager)getSystemService(LOCATION_SERVICE);if(lm==null){locationCallback(tag,null,"GPS indisponível.");return;}
        Location best=null;try{Location a=lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);Location b=lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);best=(a!=null&&b!=null)?(a.getTime()>b.getTime()?a:b):(a!=null?a:b);}catch(SecurityException ignored){}
        if(best!=null&&System.currentTimeMillis()-best.getTime()<120000){locationCallback(tag,best,null);return;}
        final LocationListener[] holder=new LocationListener[1];final boolean[] completed={false};Handler h=new Handler(Looper.getMainLooper());holder[0]=new LocationListener(){@Override public void onLocationChanged(Location l){if(completed[0])return;completed[0]=true;try{lm.removeUpdates(holder[0]);}catch(Exception ignored){}locationCallback(tag,l,null);}@Override public void onProviderEnabled(String p){}@Override public void onProviderDisabled(String p){}@Override public void onStatusChanged(String p,int st,Bundle e){}};
        try{String provider=lm.isProviderEnabled(LocationManager.GPS_PROVIDER)?LocationManager.GPS_PROVIDER:LocationManager.NETWORK_PROVIDER;lm.requestLocationUpdates(provider,0,0,holder[0]);h.postDelayed(()->{if(completed[0])return;completed[0]=true;try{lm.removeUpdates(holder[0]);}catch(Exception ignored){}Location fallback=null;try{fallback=lm.getLastKnownLocation(provider);}catch(Exception ignored){}locationCallback(tag,fallback,fallback==null?"Não foi possível obter GPS. Verifique a localização do aparelho.":null);},15000);}catch(Exception e){completed[0]=true;locationCallback(tag,best,"Não foi possível ativar o GPS.");}
    }
    private void locationCallback(String tag,Location l,String error){
        try{JSONObject o=new JSONObject();o.put("ok",l!=null);if(l!=null){o.put("latitude",l.getLatitude());o.put("longitude",l.getLongitude());if(l.hasAccuracy())o.put("accuracy",l.getAccuracy());o.put("timestamp",l.getTime());OfflineDb.get(this).putSetting("last_location",o.toString());}else o.put("error",error==null?"GPS indisponível":error);evalJs("window.agroLocationResult && window.agroLocationResult("+JSONObject.quote(tag)+","+JSONObject.quote(o.toString())+");");}catch(Exception ignored){}
    }
    public void openOnlinePage(String path){runOnUiThread(()->{if(!ApiClient.isOnline(this)){Toast.makeText(this,"Sem internet. Use os dados offline.",Toast.LENGTH_LONG).show();return;}String p=path==null?"":path.replaceFirst("^/+","");webView.loadUrl(SITE+p);});}

    private void requestBasePermissions(){if(!hasLocationPermission())requestLocationPermission();if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED)ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.CAMERA},REQ_CAMERA);if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(this,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.POST_NOTIFICATIONS},REQ_NOTIFY);}
    private Intent buildCameraIntent(){try{File dir=new File(getCacheDir(),"camera");if(!dir.exists())dir.mkdirs();File photo=File.createTempFile("agro_",".jpg",dir);cameraUri=FileProvider.getUriForFile(this,getPackageName()+".fileprovider",photo);Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);camera.putExtra(MediaStore.EXTRA_OUTPUT,cameraUri);camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);return camera;}catch(IOException e){cameraUri=null;return null;}}

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode!=REQ_FILE||fileCallback==null)return;Uri[] result=null;if(resultCode==RESULT_OK){if(data==null||(data.getData()==null&&data.getClipData()==null)){if(cameraUri!=null)result=new Uri[]{cameraUri};}else if(data.getClipData()!=null){int c=data.getClipData().getItemCount();result=new Uri[c];for(int i=0;i<c;i++)result[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)result=new Uri[]{data.getData()};}fileCallback.onReceiveValue(result);fileCallback=null;cameraUri=null;}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grants){super.onRequestPermissionsResult(requestCode,permissions,grants);if(requestCode==REQ_LOCATION&&geoCallback!=null){boolean g=hasLocationPermission();geoCallback.invoke(geoOrigin,g,false);geoCallback=null;geoOrigin=null;}}
    @Override protected void onResume(){super.onResume();if(webView!=null)evalJs("window.agroNetworkChanged && window.agroNetworkChanged("+ApiClient.isOnline(this)+");");}
    @Override protected void onPause(){CookieManager.getInstance().flush();super.onPause();}
    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else{evalJs("window.appBack && window.appBack();");}}
}
