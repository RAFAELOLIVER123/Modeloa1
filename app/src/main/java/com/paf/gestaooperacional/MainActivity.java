package com.paf.gestaooperacional;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final String LOCAL_URL="file:///android_asset/app/index.html";
    private static final String SITE="https://salmon-woodcock-375027.hostingersite.com/";
    private static final int REQ_LOCATION=1001,REQ_CAMERA=1002,REQ_FILE=1003,REQ_NOTIFY=1004,REQ_DIRECT_CAMERA=1005,REQ_AUDIO=1006;
    private WebView webView;private ProgressBar progressBar;private ValueCallback<Uri[]> fileCallback;private GeolocationPermissions.Callback geoCallback;private String geoOrigin;private FrameLayout root;
    private String pendingLocationTag,directCameraTag;private File directCameraFile;
    private MediaRecorder audioRecorder;private File audioFile;private String audioTag,pendingAudioTag;private long audioStartedAt;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);WindowCompat.setDecorFitsSystemWindows(getWindow(),false);getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        root=new FrameLayout(this);root.setBackgroundColor(android.graphics.Color.rgb(244,248,245));webView=new WebView(this);progressBar=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        root.addView(webView,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));FrameLayout.LayoutParams pp=new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,6);root.addView(progressBar,pp);setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});ViewCompat.requestApplyInsets(root);
        WindowInsetsControllerCompat ctl=new WindowInsetsControllerCompat(getWindow(),root);ctl.setAppearanceLightStatusBars(true);ctl.setAppearanceLightNavigationBars(true);
        configureWebView();requestBasePermissions();webView.loadUrl(LOCAL_URL);
        String active=OfflineDb.get(this).getActiveRouteUuid();if(active!=null&&hasLocationPermission()){Intent i=new Intent(this,LocationTrackingService.class);i.setAction(LocationTrackingService.ACTION_START);i.putExtra("route_uuid",active);ContextCompat.startForegroundService(this,i);}
    }

    private void configureWebView(){
        WebSettings s=webView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setGeolocationEnabled(true);s.setAllowFileAccess(true);s.setAllowContentAccess(true);s.setMediaPlaybackRequiresUserGesture(false);s.setSupportZoom(false);s.setBuiltInZoomControls(false);s.setTextZoom(100);s.setUserAgentString(s.getUserAgentString()+" AgroDominiumAndroid/2.3");
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(webView,true);webView.addJavascriptInterface(new AgroBridge(this),"AgroNative");
        webView.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest req){Uri uri=req.getUrl();String scheme=uri.getScheme();if("file".equalsIgnoreCase(scheme))return false;if(("http".equalsIgnoreCase(scheme)||"https".equalsIgnoreCase(scheme))&&uri.getHost()!=null&&uri.getHost().endsWith("hostingersite.com"))return false;try{startActivity(new Intent(Intent.ACTION_VIEW,uri));return true;}catch(Exception e){return false;}}@Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();if(url.startsWith(LOCAL_URL))evalJs("window.agroNetworkChanged && window.agroNetworkChanged("+ApiClient.isOnline(MainActivity.this)+");");}});
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int p){progressBar.setProgress(p);progressBar.setVisibility(p>=100?View.GONE:View.VISIBLE);}
            @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback cb){if(hasLocationPermission())cb.invoke(origin,true,false);else{geoOrigin=origin;geoCallback=cb;requestLocationPermission();}}
            @Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> cb,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;
                Intent content=new Intent(Intent.ACTION_OPEN_DOCUMENT);content.addCategory(Intent.CATEGORY_OPENABLE);content.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
                String accepts="";try{accepts=String.join(",",params.getAcceptTypes()).toLowerCase(Locale.ROOT);}catch(Exception ignored){}
                if(accepts.contains("pdf")||accepts.contains("audio")||accepts.contains("*/*")){
                    content.setType("*/*");
                    content.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/*","application/pdf","audio/*"});
                }else content.setType("image/*");
                try{startActivityForResult(Intent.createChooser(content,"Selecionar arquivos"),REQ_FILE);return true;}catch(Exception e){fileCallback=null;Toast.makeText(MainActivity.this,"Não foi possível abrir os arquivos do aparelho.",Toast.LENGTH_LONG).show();return false;}
            }
        });
    }

    public void evalJs(String js){if(webView!=null)webView.evaluateJavascript(js,null);}
    public boolean hasLocationPermission(){return ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
    public void requestLocationPermission(){ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},REQ_LOCATION);}

    public void requestSingleLocation(String tag){
        pendingLocationTag=tag;if(!hasLocationPermission()){requestLocationPermission();return;}
        LocationManager lm=(LocationManager)getSystemService(LOCATION_SERVICE);if(lm==null){pendingLocationTag=null;locationCallback(tag,null,"Serviço de localização indisponível.");return;}
        boolean gpsOn=false;try{gpsOn=lm.isProviderEnabled(LocationManager.GPS_PROVIDER);}catch(Exception ignored){}
        if(!gpsOn){try{startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));Toast.makeText(this,"Ative a localização (GPS) para continuar. O GPS funciona mesmo sem internet.",Toast.LENGTH_LONG).show();}catch(Exception ignored){}return;}
        Location fallback=null;try{fallback=lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);}catch(SecurityException ignored){}
        if(fallback!=null&&System.currentTimeMillis()-fallback.getTime()<180000){pendingLocationTag=null;locationCallback(tag,fallback,null);return;}
        final Location fallbackFinal=fallback;final boolean[] done={false};final LocationListener[] gpsListener=new LocationListener[1];final LocationListener[] netListener=new LocationListener[1];Handler h=new Handler(Looper.getMainLooper());
        Runnable finish=()->{if(done[0])return;done[0]=true;try{if(gpsListener[0]!=null)lm.removeUpdates(gpsListener[0]);if(netListener[0]!=null)lm.removeUpdates(netListener[0]);}catch(Exception ignored){}pendingLocationTag=null;locationCallback(tag,fallbackFinal,fallbackFinal==null?"O GPS não conseguiu fixar a posição. Vá para uma área aberta e toque em Capturar GPS novamente.":null);};
        LocationListener listener=new LocationListener(){@Override public void onLocationChanged(Location l){if(done[0]||l==null)return;done[0]=true;try{if(gpsListener[0]!=null)lm.removeUpdates(gpsListener[0]);if(netListener[0]!=null)lm.removeUpdates(netListener[0]);}catch(Exception ignored){}pendingLocationTag=null;locationCallback(tag,l,null);}@Override public void onProviderEnabled(String p){}@Override public void onProviderDisabled(String p){}@Override public void onStatusChanged(String p,int st,Bundle e){}};gpsListener[0]=listener;netListener[0]=listener;
        try{lm.requestLocationUpdates(LocationManager.GPS_PROVIDER,0,0,gpsListener[0],Looper.getMainLooper());}catch(Exception e){pendingLocationTag=null;locationCallback(tag,fallback,"Não foi possível iniciar o GPS.");return;}
        try{if(lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,0,0,netListener[0],Looper.getMainLooper());}catch(Exception ignored){}
        h.postDelayed(finish,60000);
    }

    private void retryPendingGps(){if(pendingLocationTag==null||!hasLocationPermission())return;LocationManager lm=(LocationManager)getSystemService(LOCATION_SERVICE);boolean on=false;try{on=lm!=null&&lm.isProviderEnabled(LocationManager.GPS_PROVIDER);}catch(Exception ignored){}if(on){String tag=pendingLocationTag;new Handler(Looper.getMainLooper()).postDelayed(()->requestSingleLocation(tag),700);}}
    private void locationCallback(String tag,Location l,String error){try{JSONObject o=new JSONObject();o.put("ok",l!=null);if(l!=null){o.put("latitude",l.getLatitude());o.put("longitude",l.getLongitude());if(l.hasAccuracy())o.put("accuracy",l.getAccuracy());o.put("timestamp",l.getTime()>0?l.getTime():System.currentTimeMillis());OfflineDb.get(this).putSetting("last_location",o.toString());}else o.put("error",error==null?"GPS indisponível.":error);evalJs("window.agroLocationResult && window.agroLocationResult("+JSONObject.quote(tag)+","+JSONObject.quote(o.toString())+");");}catch(Exception ignored){}}

    public void takePhoto(String tag){runOnUiThread(()->{try{if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.CAMERA},REQ_CAMERA);Toast.makeText(this,"Permita o uso da câmera e toque novamente.",Toast.LENGTH_LONG).show();return;}File dir=new File(getFilesDir(),"offline_photos");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Pasta de fotos indisponível.");directCameraFile=new File(dir,"foto_"+UUID.randomUUID()+".jpg");Uri uri=FileProvider.getUriForFile(this,getPackageName()+".fileprovider",directCameraFile);Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);camera.putExtra(MediaStore.EXTRA_OUTPUT,uri);camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);directCameraTag=tag;startActivityForResult(camera,REQ_DIRECT_CAMERA);}catch(Exception e){cameraCallback(tag,null,"Não foi possível abrir a câmera.");}});}
    private void optimizeCameraFile(File f){if(f==null||!f.isFile())return;try{Bitmap src=BitmapFactory.decodeFile(f.getAbsolutePath());if(src==null)return;int w=src.getWidth(),h=src.getHeight(),max=1600;Bitmap out=src;if(Math.max(w,h)>max){float k=(float)max/Math.max(w,h);out=Bitmap.createScaledBitmap(src,Math.round(w*k),Math.round(h*k),true);}try(FileOutputStream fos=new FileOutputStream(f,false)){out.compress(Bitmap.CompressFormat.JPEG,80,fos);}if(out!=src)out.recycle();src.recycle();}catch(Exception ignored){}}
    private String previewData(File f){try{Bitmap src=BitmapFactory.decodeFile(f.getAbsolutePath());if(src==null)return "";int w=src.getWidth(),h=src.getHeight(),max=360;Bitmap out=src;if(Math.max(w,h)>max){float k=(float)max/Math.max(w,h);out=Bitmap.createScaledBitmap(src,Math.round(w*k),Math.round(h*k),true);}ByteArrayOutputStream b=new ByteArrayOutputStream();out.compress(Bitmap.CompressFormat.JPEG,65,b);String data="data:image/jpeg;base64,"+Base64.encodeToString(b.toByteArray(),Base64.NO_WRAP);if(out!=src)out.recycle();src.recycle();return data;}catch(Exception e){return "";}}
    private void cameraCallback(String tag,File file,String error){try{JSONObject o=new JSONObject();boolean ok=file!=null&&file.isFile()&&file.length()>0;o.put("ok",ok);if(ok){o.put("path",file.getAbsolutePath());o.put("name",file.getName());o.put("preview",previewData(file));}else o.put("error",error==null?"Foto não registrada.":error);evalJs("window.agroCameraResult && window.agroCameraResult("+JSONObject.quote(tag)+","+JSONObject.quote(o.toString())+");");}catch(Exception ignored){}}

    public void startAudioRecording(String tag){
        runOnUiThread(()->{
            try{
                if(audioRecorder!=null){audioCallback(tag,null,0,"Já existe uma gravação em andamento.");return;}
                if(ContextCompat.checkSelfPermission(this,Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){pendingAudioTag=tag;ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.RECORD_AUDIO},REQ_AUDIO);return;}
                File dir=new File(getFilesDir(),"offline_audio");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Pasta de áudio indisponível.");
                audioFile=new File(dir,"audio_"+UUID.randomUUID()+".m4a");audioTag=tag;
                audioRecorder=Build.VERSION.SDK_INT>=31?new MediaRecorder(this):new MediaRecorder();
                audioRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
                audioRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
                audioRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
                audioRecorder.setAudioEncodingBitRate(96000);
                audioRecorder.setAudioSamplingRate(44100);
                audioRecorder.setOutputFile(audioFile.getAbsolutePath());
                audioRecorder.prepare();audioRecorder.start();audioStartedAt=SystemClock.elapsedRealtime();
                try{JSONObject o=new JSONObject().put("ok",true).put("recording",true);evalJs("window.agroAudioStarted && window.agroAudioStarted("+JSONObject.quote(tag)+","+JSONObject.quote(o.toString())+");");}catch(Exception ignored){}
            }catch(Exception e){releaseAudio(true);audioCallback(tag,null,0,"Não foi possível iniciar a gravação de áudio.");}
        });
    }

    public void stopAudioRecording(String tag){
        runOnUiThread(()->{
            if(audioRecorder==null){audioCallback(tag,null,0,"Nenhuma gravação em andamento.");return;}
            File f=audioFile;long ms=Math.max(0,SystemClock.elapsedRealtime()-audioStartedAt);String cbTag=audioTag==null?tag:audioTag;
            try{audioRecorder.stop();}catch(Exception e){if(f!=null)f.delete();releaseAudio(false);audioCallback(cbTag,null,0,"A gravação ficou curta demais. Tente novamente.");return;}
            releaseAudio(false);audioCallback(cbTag,f,ms/1000.0,null);
        });
    }

    private void releaseAudio(boolean delete){
        try{if(audioRecorder!=null){audioRecorder.reset();audioRecorder.release();}}catch(Exception ignored){}
        if(delete&&audioFile!=null)try{audioFile.delete();}catch(Exception ignored){}
        audioRecorder=null;audioFile=null;audioTag=null;audioStartedAt=0;
    }

    private void audioCallback(String tag,File f,double duration,String error){
        try{
            JSONObject o=new JSONObject();boolean ok=f!=null&&f.isFile()&&f.length()>0;o.put("ok",ok);
            if(ok){o.put("path",f.getAbsolutePath());o.put("name",f.getName());o.put("mime","audio/mp4");o.put("duration",duration);o.put("duracao_segundos",duration);}
            else o.put("error",error==null?"Áudio não registrado.":error);
            evalJs("window.agroAudioResult && window.agroAudioResult("+JSONObject.quote(tag)+","+JSONObject.quote(o.toString())+");");
        }catch(Exception ignored){}
    }

    public void openOnlinePage(String path){runOnUiThread(()->{if(!ApiClient.isOnline(this)){Toast.makeText(this,"Sem internet. Continue usando os dados offline.",Toast.LENGTH_LONG).show();return;}String p=path==null?"":path.replaceFirst("^/+","");webView.loadUrl(SITE+p);});}
    private void requestBasePermissions(){if(!hasLocationPermission())requestLocationPermission();if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED)ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.CAMERA},REQ_CAMERA);if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(this,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.POST_NOTIFICATIONS},REQ_NOTIFY);}

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==REQ_DIRECT_CAMERA){File f=directCameraFile;String tag=directCameraTag;directCameraFile=null;directCameraTag=null;if(resultCode==RESULT_OK&&f!=null&&f.isFile()){optimizeCameraFile(f);cameraCallback(tag,f,null);}else cameraCallback(tag,null,"A foto foi cancelada.");return;}if(requestCode!=REQ_FILE||fileCallback==null)return;Uri[] result=null;if(resultCode==RESULT_OK&&data!=null){if(data.getClipData()!=null){int c=data.getClipData().getItemCount();result=new Uri[c];for(int i=0;i<c;i++)result[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)result=new Uri[]{data.getData()};}fileCallback.onReceiveValue(result);fileCallback=null;}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grants){super.onRequestPermissionsResult(requestCode,permissions,grants);if(requestCode==REQ_LOCATION){boolean g=hasLocationPermission();if(geoCallback!=null){geoCallback.invoke(geoOrigin,g,false);geoCallback=null;geoOrigin=null;}if(g)retryPendingGps();else if(pendingLocationTag!=null){String t=pendingLocationTag;pendingLocationTag=null;locationCallback(t,null,"Permissão de localização negada.");}}else if(requestCode==REQ_AUDIO){String t=pendingAudioTag;pendingAudioTag=null;if(t!=null){if(ContextCompat.checkSelfPermission(this,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)startAudioRecording(t);else audioCallback(t,null,0,"Permissão do microfone negada.");}}}
    @Override protected void onResume(){super.onResume();if(webView!=null)evalJs("window.agroNetworkChanged && window.agroNetworkChanged("+ApiClient.isOnline(this)+");");retryPendingGps();}
    @Override protected void onPause(){CookieManager.getInstance().flush();super.onPause();}
    @Override protected void onDestroy(){if(audioRecorder!=null)releaseAudio(true);super.onDestroy();}
    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else evalJs("window.appBack && window.appBack();");}
}
