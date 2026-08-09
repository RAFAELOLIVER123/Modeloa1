package com.paf.gestaooperacional;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Locale;
import java.util.UUID;

public class AgroBridge {
    private final MainActivity activity;
    private final OfflineDb db;
    public AgroBridge(MainActivity a){activity=a;db=OfflineDb.get(a);}

    @JavascriptInterface public String getState(){
        try{
            JSONObject o=db.stats();o.put("online",ApiClient.isOnline(activity));o.put("authenticated",!db.getSetting("token","").isEmpty());o.put("user",jsonOrNull(db.getSetting("user_json","")));o.put("groups",arrayOrEmpty(db.getSetting("groups_json","[]")));o.put("group_id",toInt(db.getSetting("group_id","0")));o.put("version","2.0.0");return o.toString();
        }catch(Exception e){return "{\"online\":false,\"error\":\"state\"}";}
    }
    @JavascriptInterface public String getSnapshot(){String s=db.getSnapshot();return s.isEmpty()?"{}":s;}
    @JavascriptInterface public String getQueue(){try{return db.queueSummary().toString();}catch(Exception e){return "[]";}}
    @JavascriptInterface public boolean isOnline(){return ApiClient.isOnline(activity);}

    @JavascriptInterface public void login(String login,String password){
        new Thread(()->{
            try{
                if(!ApiClient.isOnline(activity))throw new IllegalStateException("A primeira conexão precisa de internet. Depois os dados ficam no aparelho.");
                String did=Settings.Secure.getString(activity.getContentResolver(),Settings.Secure.ANDROID_ID);String name=Build.MANUFACTURER+" "+Build.MODEL;
                JSONObject r=ApiClient.login(login,password,did,name);db.putSetting("token",r.getString("token"));db.putSetting("user_json",r.getJSONObject("user").toString());db.putSetting("groups_json",r.getJSONArray("groups").toString());db.putSetting("group_id",String.valueOf(r.getInt("group_id")));
                try{SyncEngine.refresh(activity,r.getInt("group_id"));}catch(Exception ignored){}
                callback("agroLoginResult",ok("Conectado. Os dados já podem ser usados offline."));
            }catch(Exception e){callback("agroLoginResult",fail(message(e)));}
        }).start();
    }

    @JavascriptInterface public void refreshData(int groupId){
        new Thread(()->{try{if(!ApiClient.isOnline(activity))throw new IllegalStateException("Sem internet. Continue usando os dados já baixados e atualize quando houver sinal.");SyncEngine.refresh(activity,groupId);callback("agroRefreshResult",ok("Dados atualizados no aparelho."));}catch(Exception e){callback("agroRefreshResult",fail(message(e)));}}).start();
    }
    @JavascriptInterface public void syncNow(){
        new Thread(()->{
            try{
                if(!ApiClient.isOnline(activity)){SyncScheduler.schedule(activity);throw new IllegalStateException("Sem internet. Nada foi perdido; a sincronização ficou aguardando conexão.");}
                JSONObject r=SyncEngine.syncAll(activity,(done,total,msg)->callback("agroSyncProgress",progress(done,total,msg)),true);callback("agroSyncResult",r.toString());
            }catch(Exception e){callback("agroSyncResult",fail(message(e)));}
        }).start();
    }

    @JavascriptInterface public String queueOperation(String type,String payloadJson,String photosJson){
        try{int gid=toInt(db.getSetting("group_id","0"));String uuid=UUID.randomUUID().toString();db.enqueue(type,gid,payloadJson,photosJson,uuid);SyncScheduler.schedule(activity);return new JSONObject().put("ok",true).put("client_uuid",uuid).put("pending",db.pendingCount()).toString();}catch(Exception e){return fail(message(e));}
    }
    @JavascriptInterface public String savePhoto(String dataUrl,String originalName){
        try{
            String data=dataUrl;int comma=data.indexOf(',');if(comma>=0)data=data.substring(comma+1);byte[] bytes=Base64.decode(data,Base64.DEFAULT);if(bytes.length>6*1024*1024)throw new IllegalStateException("Foto muito grande. Tente novamente.");File dir=new File(activity.getFilesDir(),"offline_photos");if(!dir.exists()&&!dir.mkdirs())throw new IllegalStateException("Não foi possível criar a pasta local.");String ext=ext(originalName);File f=new File(dir,UUID.randomUUID()+"."+ext);try(FileOutputStream out=new FileOutputStream(f)){out.write(bytes);}return new JSONObject().put("ok",true).put("path",f.getAbsolutePath()).put("name",f.getName()).toString();
        }catch(Exception e){return fail(message(e));}
    }
    @JavascriptInterface public void requestLocation(String contextTag){activity.requestSingleLocation(contextTag);}

    @JavascriptInterface public String startRoute(String programRef,String title){
        try{
            if(!activity.hasLocationPermission()){activity.requestLocationPermission();return fail("Permita a localização e toque em iniciar novamente.");}
            int gid=toInt(db.getSetting("group_id","0"));String uuid=db.createRoute(gid,programRef,title);Intent i=new Intent(activity,LocationTrackingService.class);i.setAction(LocationTrackingService.ACTION_START);i.putExtra("route_uuid",uuid);androidx.core.content.ContextCompat.startForegroundService(activity,i);return new JSONObject().put("ok",true).put("route_uuid",uuid).put("message","Rota gravando no celular.").toString();
        }catch(Exception e){return fail(message(e));}
    }
    @JavascriptInterface public String stopRoute(){
        try{
            String uuid=db.finishActiveRoute();Intent i=new Intent(activity,LocationTrackingService.class);i.setAction(LocationTrackingService.ACTION_STOP);activity.startService(i);if(uuid==null)return fail("Nenhuma rota ativa.");JSONObject p=new JSONObject();p.put("route_uuid",uuid);int gid=toInt(db.getSetting("group_id","0"));db.enqueue("route.sync",gid,p.toString(),"[]",uuid);SyncScheduler.schedule(activity);return new JSONObject().put("ok",true).put("route_uuid",uuid).put("points",db.routePointCount(uuid)).put("pending",db.pendingCount()).toString();
        }catch(Exception e){return fail(message(e));}
    }
    @JavascriptInterface public String routeStatus(){try{return db.routeStatus().toString();}catch(Exception e){return "{\"active\":false}";}}

    @JavascriptInterface public String setGroup(int groupId){
        try{JSONArray gs=arrayOrEmpty(db.getSetting("groups_json","[]"));boolean ok=false;for(int i=0;i<gs.length();i++)if(gs.getJSONObject(i).optInt("id")==groupId){ok=true;break;}if(!ok)return fail("Grupo não permitido.");db.putSetting("group_id",String.valueOf(groupId));return ok("Grupo alterado. Atualize os dados quando estiver online.");}catch(Exception e){return fail(message(e));}
    }
    @JavascriptInterface public void openOnlinePage(String path){activity.openOnlinePage(path);}
    @JavascriptInterface public void logout(){
        String token=db.getSetting("token","");db.logoutKeepData();if(!token.isEmpty()&&ApiClient.isOnline(activity))new Thread(()->{try{ApiClient.logout(token);}catch(Exception ignored){}}).start();callback("agroLoggedOut",ok("Sessão removida. Os dados baixados continuam no aparelho."));
    }
    @JavascriptInterface public String clearLocalData(){try{db.clearEverything();return ok("Dados locais apagados.");}catch(Exception e){return fail(message(e));}}

    private void callback(String fn,String json){activity.runOnUiThread(()->activity.evalJs("window."+fn+" && window."+fn+"("+JSONObject.quote(json)+");"));}
    private String progress(int d,int t,String m){try{return new JSONObject().put("done",d).put("total",t).put("message",m).toString();}catch(Exception e){return "{}";}}
    private static JSONObject jsonOrNull(String s){try{return s==null||s.isEmpty()?new JSONObject():new JSONObject(s);}catch(Exception e){return new JSONObject();}}
    private static JSONArray arrayOrEmpty(String s){try{return new JSONArray(s);}catch(Exception e){return new JSONArray();}}
    private static int toInt(String s){try{return Integer.parseInt(s);}catch(Exception e){return 0;}}
    private static String ext(String n){String x=n==null?"":n.toLowerCase(Locale.ROOT);if(x.endsWith(".png"))return"png";if(x.endsWith(".webp"))return"webp";return"jpg";}
    private static String message(Exception e){String m=e.getMessage();return m==null||m.isEmpty()?e.getClass().getSimpleName():m;}
    private static String ok(String msg){try{return new JSONObject().put("ok",true).put("message",msg).toString();}catch(Exception e){return "{\"ok\":true}";}}
    private static String fail(String msg){try{return new JSONObject().put("ok",false).put("error",msg).toString();}catch(Exception e){return "{\"ok\":false}";}}
}
