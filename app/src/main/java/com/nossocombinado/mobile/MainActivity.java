package com.nossocombinado.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.net.URI;

public class MainActivity extends Activity {
  private static final String HOME="https://violet-grasshopper-887660.hostingersite.com/";
  private static final String HOST="violet-grasshopper-887660.hostingersite.com";
  private static final int FILE_REQUEST=100, GEO_REQUEST=101;
  private WebView web;
  private ValueCallback<Uri[]> files;
  private GeolocationPermissions.Callback geo;
  private String geoOrigin;
  private FrameLayout frame;
  private LinearLayout offline;
  private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
  private Button button(String title){
    Button b=new Button(this);
    b.setAllCaps(false); b.setText(title); b.setTextSize(12); b.setTextColor(Color.rgb(30,48,71));
    b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(231,236,250)));
    return b;
  }
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().setStatusBarColor(Color.rgb(28,42,67));
    getWindow().setNavigationBarColor(Color.rgb(246,248,252));
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(1);root.setBackgroundColor(Color.WHITE);
    LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);
    header.setPadding(dp(12),dp(4),dp(12),dp(4));
    TextView brand=new TextView(this);brand.setText("Nosso Combinado");brand.setTextColor(Color.rgb(28,42,67));brand.setTextSize(17);brand.setTypeface(null,1);
    header.addView(brand,new LinearLayout.LayoutParams(0,dp(48),1));
    Button refresh=button("↻ Atualizar");refresh.setOnClickListener(v->web.reload());
    header.addView(refresh,new LinearLayout.LayoutParams(dp(105),dp(43)));
    root.addView(header,new LinearLayout.LayoutParams(-1,dp(56)));

    HorizontalScrollView scroller=new HorizontalScrollView(this);
    scroller.setHorizontalScrollBarEnabled(false);scroller.setBackgroundColor(Color.rgb(244,246,252));
    LinearLayout nav=new LinearLayout(this);nav.setPadding(dp(8),dp(3),dp(8),dp(3));
    String[] labels={"Início","Comparador de preços","Financeiro","▦ Planejamento mensal"};
    String[] pages={"home","price-compare","finance","finance-matrix"};
    for(int i=0;i<labels.length;i++){
      String page=pages[i];Button tab=button(labels[i]);
      LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-2,dp(43));p.rightMargin=dp(5);
      nav.addView(tab,p);tab.setOnClickListener(v->navigate(page));
    }
    scroller.addView(nav);root.addView(scroller,new LinearLayout.LayoutParams(-1,dp(50)));

    frame=new FrameLayout(this);web=new WebView(this);
    WebSettings config=web.getSettings();
    config.setJavaScriptEnabled(true);config.setDomStorageEnabled(true);
    config.setDatabaseEnabled(true);config.setLoadsImagesAutomatically(true);
    config.setSupportZoom(true);config.setBuiltInZoomControls(true);
    config.setDisplayZoomControls(false);config.setMediaPlaybackRequiresUserGesture(false);
    config.setAllowFileAccess(false);config.setJavaScriptCanOpenWindowsAutomatically(false);
    config.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return outside(r.getUrl());}
      @Override public void onPageFinished(WebView v,String url){offline.setVisibility(View.GONE);}
      @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){
        if(r.isForMainFrame()) offline.setVisibility(View.VISIBLE);
      }
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(files!=null)files.onReceiveValue(null); files=callback;
        try{startActivityForResult(params.createIntent(),FILE_REQUEST);}
        catch(Exception err){files.onReceiveValue(null);files=null;Toast.makeText(MainActivity.this,"Não foi possível escolher o arquivo",0).show();}
        return true;
      }
      @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback){
        if(!official(origin)){callback.invoke(origin,false,false);return;}
        if(Build.VERSION.SDK_INT<23||checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||
          checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED){
          callback.invoke(origin,true,false);return;
        }
        geo=callback;geoOrigin=origin;
        new AlertDialog.Builder(MainActivity.this).setTitle("Mapa da família")
          .setMessage("Permitir acesso à localização para mostrar sua posição?")
          .setNegativeButton("Agora não",(d,w)->{if(geo!=null){geo.invoke(geoOrigin,false,false);geo=null;}})
          .setPositiveButton("Permitir",(d,w)->requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},GEO_REQUEST)).show();
      }
    });
    web.setDownloadListener((url,ua,disposition,mime,size)->{
      if(!official(url)){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){}return;}
      try{
        DownloadManager.Request r=new DownloadManager.Request(Uri.parse(url));
        String name=URLUtil.guessFileName(url,disposition,mime);
        String cookie=CookieManager.getInstance().getCookie(url);
        if(cookie!=null)r.addRequestHeader("Cookie",cookie);
        r.addRequestHeader("User-Agent",ua);r.setMimeType(mime);r.setTitle(name);
        r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,name);
        ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(r);
        Toast.makeText(this,"Download iniciado",0).show();
      }catch(Exception e){Toast.makeText(this,"Não foi possível baixar o arquivo",1).show();}
    });
    frame.addView(web,new FrameLayout.LayoutParams(-1,-1));
    offline=new LinearLayout(this);offline.setOrientation(1);offline.setGravity(Gravity.CENTER);
    offline.setBackgroundColor(Color.WHITE);
    TextView warning=new TextView(this);warning.setText("Sem conexão com o Nosso Combinado.\nConfira sua internet.");
    warning.setGravity(Gravity.CENTER);warning.setTextSize(16);warning.setTextColor(Color.DKGRAY);
    offline.addView(warning,new LinearLayout.LayoutParams(-1,dp(95)));
    Button retry=button("Tentar novamente");retry.setOnClickListener(v->{offline.setVisibility(View.GONE);web.loadUrl(HOME);});
    offline.addView(retry);
    offline.setVisibility(View.GONE);frame.addView(offline,new FrameLayout.LayoutParams(-1,-1));
    root.addView(frame,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
    if(saved==null||web.restoreState(saved)==null)web.loadUrl(HOME);
    if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
      requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},102);
  }
  private boolean official(String value){
    try{URI uri=new URI(value);return "https".equalsIgnoreCase(uri.getScheme())&&HOST.equalsIgnoreCase(uri.getHost());}
    catch(Exception e){return false;}
  }
  private boolean outside(Uri uri){
    if(official(uri.toString()))return false;
    String scheme=uri.getScheme();
    if("about".equals(scheme)||"blob".equals(scheme))return false;
    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}
    catch(Exception e){Toast.makeText(this,"Link não disponível",0).show();}
    return true;
  }
  private void navigate(String page){
    if(page.equals("home")){web.loadUrl(HOME);return;}
    if(!official(web.getUrl()==null?"":web.getUrl())){web.loadUrl(HOME);return;}
    String script="(function(){var e=document.querySelector('[data-nav=\""+page+"\"]');if(e){e.click();return true;}return false;})()";
    web.evaluateJavascript(script,result->{
      if(!"true".equals(result))Toast.makeText(this,"Entre em sua conta para abrir essa ferramenta",1).show();
    });
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==FILE_REQUEST&&files!=null){files.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));files=null;}
  }
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
    super.onRequestPermissionsResult(request,permissions,results);
    if(request==GEO_REQUEST&&geo!=null){
      boolean granted=false;for(int r:results)if(r==PackageManager.PERMISSION_GRANTED)granted=true;
      geo.invoke(geoOrigin,granted,false);geo=null;geoOrigin=null;
    }
  }
  @Override protected void onSaveInstanceState(Bundle state){if(web!=null)web.saveState(state);super.onSaveInstanceState(state);}
  @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
  @Override protected void onDestroy(){if(web!=null){if(files!=null)files.onReceiveValue(null);frame.removeView(web);web.destroy();web=null;}super.onDestroy();}
}
