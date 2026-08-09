package com.paf.gestaooperacional;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class LocationTrackingService extends Service implements LocationListener {
    public static final String ACTION_START="com.paf.gestaooperacional.START_ROUTE";
    public static final String ACTION_STOP="com.paf.gestaooperacional.STOP_ROUTE";
    private static final String CHANNEL="agrodominium_rota";
    private static final int NOTIF=731;
    private LocationManager lm;private OfflineDb db;private String routeUuid;private long lastStoredAt=0L;private Location lastStored;
    @Override public void onCreate(){super.onCreate();db=OfflineDb.get(this);lm=(LocationManager)getSystemService(LOCATION_SERVICE);createChannel();}
    @Override public int onStartCommand(Intent intent,int flags,int startId){if(intent!=null&&ACTION_STOP.equals(intent.getAction())){stopTracking();stopForeground(true);stopSelf();return START_NOT_STICKY;}routeUuid=intent!=null?intent.getStringExtra("route_uuid"):null;if(routeUuid==null||routeUuid.isEmpty())routeUuid=db.getActiveRouteUuid();if(routeUuid==null){stopSelf();return START_NOT_STICKY;}startForeground(NOTIF,notification("Rota em andamento",db.routePointCount(routeUuid)));startTracking();return START_STICKY;}
    private void startTracking(){if(ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED&&ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return;try{if(lm.isProviderEnabled(LocationManager.GPS_PROVIDER))lm.requestLocationUpdates(LocationManager.GPS_PROVIDER,10000,5,this);}catch(Exception ignored){}try{if(lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,15000,10,this);}catch(Exception ignored){}}
    private void stopTracking(){try{lm.removeUpdates(this);}catch(Exception ignored){}}
    @Override public void onLocationChanged(Location loc){if(routeUuid==null)return;long now=System.currentTimeMillis();if(lastStored!=null){float d=lastStored.distanceTo(loc);if(d<3f&&now-lastStoredAt<10000)return;}db.addRoutePoint(routeUuid,loc.getLatitude(),loc.getLongitude(),loc.hasAccuracy()?loc.getAccuracy():null,loc.hasAltitude()?loc.getAltitude():null,loc.hasSpeed()?loc.getSpeed():null,loc.hasBearing()?loc.getBearing():null,loc.getTime()>0?loc.getTime():now);try{org.json.JSONObject j=new org.json.JSONObject();j.put("latitude",loc.getLatitude());j.put("longitude",loc.getLongitude());j.put("accuracy",loc.hasAccuracy()?loc.getAccuracy():org.json.JSONObject.NULL);j.put("captured_at",now);db.putSetting("last_location",j.toString());}catch(Exception ignored){}lastStoredAt=now;lastStored=new Location(loc);int count=db.routePointCount(routeUuid);NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(nm!=null)nm.notify(NOTIF,notification("Rota sendo gravada no aparelho",count));}
    private Notification notification(String text,int count){Intent open=new Intent(this,MainActivity.class);open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Intent stop=new Intent(this,LocationTrackingService.class);stop.setAction(ACTION_STOP);PendingIntent ps=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);return new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(com.paf.gestaooperacional.R.drawable.ic_stat_agro).setContentTitle("AgroDominium · GPS ativo").setContentText(text+" · "+count+" pontos salvos").setOngoing(true).setOnlyAlertOnce(true).setContentIntent(pi).addAction(0,"Parar GPS",ps).setPriority(NotificationCompat.PRIORITY_LOW).build();}
    private void createChannel(){if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel(CHANNEL,"Rota de campo",NotificationManager.IMPORTANCE_LOW);c.setDescription("Mantém o GPS da atividade sendo salvo no aparelho.");NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(nm!=null)nm.createNotificationChannel(c);}}
    @Override public void onDestroy(){stopTracking();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onProviderEnabled(String provider){}
    @Override public void onProviderDisabled(String provider){}
    @Override public void onStatusChanged(String provider,int status,Bundle extras){}
}
