package com.paf.gestaooperacional;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

public class OfflineDb extends SQLiteOpenHelper {
    private static final String DB_NAME = "agrodominium_offline.db";
    private static final int DB_VERSION = 2;
    private static OfflineDb instance;
    public static synchronized OfflineDb get(Context c) { if (instance == null) instance = new OfflineDb(c.getApplicationContext()); return instance; }
    private OfflineDb(Context c) { super(c, DB_NAME, null, DB_VERSION); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT)");
        db.execSQL("CREATE TABLE snapshot(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL,updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE sync_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,client_uuid TEXT NOT NULL UNIQUE,type TEXT NOT NULL,group_id INTEGER,payload_json TEXT NOT NULL,photos_json TEXT,status TEXT NOT NULL DEFAULT 'PENDING',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,response_json TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX idx_sync_status ON sync_queue(status,created_at)");
        db.execSQL("CREATE TABLE routes(uuid TEXT PRIMARY KEY,group_id INTEGER,programacao_ref TEXT,title TEXT,started_at TEXT NOT NULL,ended_at TEXT,status TEXT NOT NULL DEFAULT 'ATIVA',synced INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX idx_routes_status ON routes(status,updated_at)");
        db.execSQL("CREATE TABLE route_points(id INTEGER PRIMARY KEY AUTOINCREMENT,uuid TEXT NOT NULL UNIQUE,route_uuid TEXT NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,accuracy REAL,altitude REAL,speed REAL,bearing REAL,captured_at TEXT NOT NULL,created_at INTEGER NOT NULL,FOREIGN KEY(route_uuid) REFERENCES routes(uuid) ON DELETE CASCADE)");
        db.execSQL("CREATE INDEX idx_route_points_route ON route_points(route_uuid,id)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { if (oldVersion < 2) { try { db.execSQL("ALTER TABLE sync_queue ADD COLUMN response_json TEXT"); } catch (Exception ignored) {} } }

    public synchronized void putSetting(String key, String value) { ContentValues v = new ContentValues(); v.put("key",key); v.put("value",value == null ? "" : value); getWritableDatabase().insertWithOnConflict("settings",null,v,SQLiteDatabase.CONFLICT_REPLACE); }
    public synchronized String getSetting(String key, String def) { try (Cursor c=getReadableDatabase().query("settings",new String[]{"value"},"key=?",new String[]{key},null,null,null,"1")) { return c.moveToFirst()?c.getString(0):def; } }
    public synchronized void removeSetting(String key) { getWritableDatabase().delete("settings","key=?",new String[]{key}); }
    public synchronized void saveSnapshot(String json) { ContentValues v=new ContentValues();v.put("id",1);v.put("json",json);v.put("updated_at",System.currentTimeMillis());getWritableDatabase().insertWithOnConflict("snapshot",null,v,SQLiteDatabase.CONFLICT_REPLACE); }
    public synchronized String getSnapshot() { try(Cursor c=getReadableDatabase().query("snapshot",new String[]{"json"},"id=1",null,null,null,null,"1")){return c.moveToFirst()?c.getString(0):"";} }
    public synchronized long getSnapshotTime() { try(Cursor c=getReadableDatabase().query("snapshot",new String[]{"updated_at"},"id=1",null,null,null,null,"1")){return c.moveToFirst()?c.getLong(0):0L;} }

    public synchronized String enqueue(String type,int groupId,String payloadJson,String photosJson,String clientUuid) {
        if(clientUuid==null||clientUuid.isEmpty())clientUuid=UUID.randomUUID().toString();long now=System.currentTimeMillis();ContentValues v=new ContentValues();v.put("client_uuid",clientUuid);v.put("type",type);v.put("group_id",groupId);v.put("payload_json",payloadJson==null?"{}":payloadJson);v.put("photos_json",photosJson==null?"[]":photosJson);v.put("status","PENDING");v.put("created_at",now);v.put("updated_at",now);getWritableDatabase().insertWithOnConflict("sync_queue",null,v,SQLiteDatabase.CONFLICT_IGNORE);return clientUuid;
    }
    public synchronized int pendingCount() { try(Cursor c=getReadableDatabase().rawQuery("SELECT COUNT(*) FROM sync_queue WHERE status IN('PENDING','FAILED')",null)){return c.moveToFirst()?c.getInt(0):0;} }
    public synchronized JSONArray pending(int limit) throws JSONException {
        JSONArray a=new JSONArray();String lim=String.valueOf(Math.max(1,Math.min(limit,500)));
        try(Cursor c=getReadableDatabase().query("sync_queue",null,"status IN('PENDING','FAILED')",null,null,null,"created_at ASC",lim)){while(c.moveToNext()){JSONObject o=new JSONObject();o.put("id",c.getLong(c.getColumnIndexOrThrow("id")));o.put("client_uuid",c.getString(c.getColumnIndexOrThrow("client_uuid")));o.put("type",c.getString(c.getColumnIndexOrThrow("type")));o.put("group_id",c.getInt(c.getColumnIndexOrThrow("group_id")));o.put("payload_json",c.getString(c.getColumnIndexOrThrow("payload_json")));o.put("photos_json",c.getString(c.getColumnIndexOrThrow("photos_json")));o.put("attempts",c.getInt(c.getColumnIndexOrThrow("attempts")));o.put("last_error",c.getString(c.getColumnIndexOrThrow("last_error")));a.put(o);}}
        return a;
    }
    public synchronized JSONArray queueSummary() throws JSONException {
        JSONArray a=new JSONArray();try(Cursor c=getReadableDatabase().query("sync_queue",new String[]{"id","client_uuid","type","group_id","payload_json","photos_json","status","attempts","last_error","created_at"},null,null,null,null,"created_at DESC","100")){while(c.moveToNext()){JSONObject o=new JSONObject();o.put("id",c.getLong(0));o.put("client_uuid",c.getString(1));o.put("type",c.getString(2));o.put("group_id",c.getInt(3));o.put("payload_json",c.getString(4));o.put("photos_json",c.getString(5));o.put("status",c.getString(6));o.put("attempts",c.getInt(7));o.put("last_error",c.getString(8));o.put("created_at",c.getLong(9));a.put(o);}}return a;
    }
    public synchronized void markSending(long id){ContentValues v=new ContentValues();v.put("status","SENDING");v.put("updated_at",System.currentTimeMillis());getWritableDatabase().update("sync_queue",v,"id=?",new String[]{String.valueOf(id)});}
    public synchronized void markSynced(long id,String response){ContentValues v=new ContentValues();v.put("status","SYNCED");v.put("response_json",response);v.putNull("last_error");v.put("updated_at",System.currentTimeMillis());getWritableDatabase().update("sync_queue",v,"id=?",new String[]{String.valueOf(id)});}
    public synchronized void markFailed(long id,String error){getWritableDatabase().execSQL("UPDATE sync_queue SET status='FAILED',attempts=attempts+1,last_error=?,updated_at=? WHERE id=?",new Object[]{error,System.currentTimeMillis(),id});}
    public synchronized void resetSending(){getWritableDatabase().execSQL("UPDATE sync_queue SET status='FAILED',last_error=COALESCE(last_error,'Sincronização interrompida'),updated_at=? WHERE status='SENDING'",new Object[]{System.currentTimeMillis()});}
    public synchronized void purgeSynced(){getWritableDatabase().delete("sync_queue","status='SYNCED' AND updated_at<?",new String[]{String.valueOf(System.currentTimeMillis()-7L*24*3600*1000)});}

    private String nowSql(){return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.US).format(new Date());}
    public synchronized String createRoute(int groupId,String programRef,String title){String existing=getActiveRouteUuid();if(existing!=null)return existing;String uuid=UUID.randomUUID().toString();long now=System.currentTimeMillis();ContentValues v=new ContentValues();v.put("uuid",uuid);v.put("group_id",groupId);v.put("programacao_ref",programRef);v.put("title",title==null||title.isEmpty()?"Rota de campo":title);v.put("started_at",nowSql());v.put("status","ATIVA");v.put("created_at",now);v.put("updated_at",now);getWritableDatabase().insertOrThrow("routes",null,v);return uuid;}
    public synchronized String getActiveRouteUuid(){try(Cursor c=getReadableDatabase().rawQuery("SELECT uuid FROM routes WHERE status='ATIVA' ORDER BY created_at DESC LIMIT 1",null)){return c.moveToFirst()?c.getString(0):null;}}
    public synchronized JSONObject routeStatus() throws JSONException {JSONObject o=new JSONObject();try(Cursor c=getReadableDatabase().rawQuery("SELECT uuid,group_id,programacao_ref,title,started_at,ended_at,status FROM routes ORDER BY created_at DESC LIMIT 1",null)){if(!c.moveToFirst()){o.put("active",false);return o;}String uuid=c.getString(0);o.put("uuid",uuid);o.put("group_id",c.getInt(1));o.put("programacao_ref",c.getString(2));o.put("title",c.getString(3));o.put("started_at",c.getString(4));o.put("ended_at",c.getString(5));o.put("status",c.getString(6));o.put("active","ATIVA".equals(c.getString(6)));o.put("points",routePointCount(uuid));}return o;}
    public synchronized void addRoutePoint(String routeUuid,double lat,double lng,Float accuracy,Double altitude,Float speed,Float bearing,long timeMs){if(routeUuid==null||routeUuid.isEmpty())return;ContentValues v=new ContentValues();v.put("uuid",UUID.randomUUID().toString());v.put("route_uuid",routeUuid);v.put("latitude",lat);v.put("longitude",lng);if(accuracy!=null)v.put("accuracy",accuracy);if(altitude!=null)v.put("altitude",altitude);if(speed!=null)v.put("speed",speed);if(bearing!=null)v.put("bearing",bearing);v.put("captured_at",new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.US).format(new Date(timeMs)));v.put("created_at",System.currentTimeMillis());getWritableDatabase().insertWithOnConflict("route_points",null,v,SQLiteDatabase.CONFLICT_IGNORE);ContentValues r=new ContentValues();r.put("updated_at",System.currentTimeMillis());getWritableDatabase().update("routes",r,"uuid=?",new String[]{routeUuid});}
    public synchronized int routePointCount(String routeUuid){try(Cursor c=getReadableDatabase().rawQuery("SELECT COUNT(*) FROM route_points WHERE route_uuid=?",new String[]{routeUuid})){return c.moveToFirst()?c.getInt(0):0;}}
    public synchronized String finishActiveRoute(){String uuid=getActiveRouteUuid();if(uuid==null)return null;ContentValues v=new ContentValues();v.put("ended_at",nowSql());v.put("status","FINALIZADA");v.put("updated_at",System.currentTimeMillis());getWritableDatabase().update("routes",v,"uuid=?",new String[]{uuid});return uuid;}
    public synchronized JSONObject buildRoutePayload(String routeUuid) throws JSONException {JSONObject p=new JSONObject();try(Cursor c=getReadableDatabase().rawQuery("SELECT uuid,programacao_ref,title,started_at,ended_at,status FROM routes WHERE uuid=? LIMIT 1",new String[]{routeUuid})){if(!c.moveToFirst())throw new JSONException("Rota local não encontrada");p.put("route_uuid",c.getString(0));String pref=c.getString(1);if(pref!=null&&!pref.isEmpty()){if(pref.matches("\\d+"))p.put("programacao_id",Long.parseLong(pref));else p.put("programacao_client_uuid",pref);}p.put("title",c.getString(2));p.put("started_at",c.getString(3));if(c.getString(4)!=null)p.put("ended_at",c.getString(4));p.put("status",c.getString(5));}JSONArray pts=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT uuid,latitude,longitude,accuracy,altitude,speed,bearing,captured_at FROM route_points WHERE route_uuid=? ORDER BY id",new String[]{routeUuid})){while(c.moveToNext()){JSONObject x=new JSONObject();x.put("uuid",c.getString(0));x.put("latitude",c.getDouble(1));x.put("longitude",c.getDouble(2));if(!c.isNull(3))x.put("accuracy",c.getDouble(3));if(!c.isNull(4))x.put("altitude",c.getDouble(4));if(!c.isNull(5))x.put("speed",c.getDouble(5));if(!c.isNull(6))x.put("bearing",c.getDouble(6));x.put("captured_at",c.getString(7));pts.put(x);}}p.put("points",pts);return p;}
    public synchronized void markRouteSynced(String routeUuid){ContentValues v=new ContentValues();v.put("synced",1);v.put("updated_at",System.currentTimeMillis());getWritableDatabase().update("routes",v,"uuid=?",new String[]{routeUuid});}

    public synchronized JSONObject localMapData() throws JSONException {
        JSONObject out=new JSONObject();
        JSONArray routes=new JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT uuid,group_id,programacao_ref,title,started_at,ended_at,status,synced FROM routes ORDER BY created_at DESC LIMIT 120",null)){
            while(c.moveToNext()){
                JSONObject r=new JSONObject();String uuid=c.getString(0);
                r.put("uuid",uuid);r.put("group_id",c.getInt(1));r.put("programacao_ref",c.getString(2));r.put("title",c.getString(3));r.put("started_at",c.getString(4));r.put("ended_at",c.getString(5));r.put("status",c.getString(6));r.put("synced",c.getInt(7));
                JSONArray pts=new JSONArray();
                try(Cursor p=getReadableDatabase().rawQuery("SELECT latitude,longitude,accuracy,altitude,speed,bearing,captured_at FROM route_points WHERE route_uuid=? ORDER BY id",new String[]{uuid})){
                    while(p.moveToNext()){
                        JSONObject x=new JSONObject();x.put("latitude",p.getDouble(0));x.put("longitude",p.getDouble(1));if(!p.isNull(2))x.put("accuracy",p.getDouble(2));if(!p.isNull(3))x.put("altitude",p.getDouble(3));if(!p.isNull(4))x.put("speed",p.getDouble(4));if(!p.isNull(5))x.put("bearing",p.getDouble(5));x.put("captured_at",p.getString(6));pts.put(x);
                    }
                }
                r.put("points",pts);routes.put(r);
            }
        }
        out.put("routes",routes);
        String last=getSetting("last_location","");
        if(!last.isEmpty()){try{out.put("last_location",new JSONObject(last));}catch(Exception ignored){}}
        return out;
    }

    public synchronized JSONObject stats() throws JSONException {JSONObject o=new JSONObject();o.put("pending",pendingCount());o.put("snapshot_at",getSnapshotTime());o.put("has_snapshot",!getSnapshot().isEmpty());o.put("route",routeStatus());return o;}
    public synchronized void logoutKeepData(){removeSetting("token");removeSetting("user_json");removeSetting("groups_json");}
    public synchronized void clearEverything(){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.delete("sync_queue",null,null);db.delete("route_points",null,null);db.delete("routes",null,null);db.delete("snapshot",null,null);db.delete("settings",null,null);db.setTransactionSuccessful();}finally{db.endTransaction();}}
}
