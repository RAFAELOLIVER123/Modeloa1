package com.paf.gestaooperacional;

import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import org.json.JSONObject;

public class MainActivityV23 extends MainActivity {
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SyncScheduler.schedule(this);
        watchNetwork();
    }

    @Override public void requestSingleLocation(String tag) {
        if (!hasLocationPermission()) {
            super.requestSingleLocation(tag);
            return;
        }
        LocationManager lm=(LocationManager)getSystemService(Context.LOCATION_SERVICE);
        if(lm==null){sendLocation(tag,null,"Serviço de localização indisponível.");return;}
        boolean gpsOn=false;
        try{gpsOn=lm.isProviderEnabled(LocationManager.GPS_PROVIDER);}catch(Exception ignored){}
        if(!gpsOn){
            sendLocation(tag,null,"Ative o GPS do celular. A captura funciona sem internet, mas a localização precisa estar ligada.");
            try{startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));}catch(Exception ignored){}
            return;
        }

        final boolean[] done={false};
        final Location[] best={null};
        final Handler handler=new Handler(Looper.getMainLooper());
        final LocationListener[] listener={null};
        listener[0]=new LocationListener(){
            @Override public void onLocationChanged(Location loc){
                if(done[0]||loc==null)return;
                if(best[0]==null || score(loc)>score(best[0]))best[0]=loc;
                if((loc.hasAccuracy()&&loc.getAccuracy()<=35f)||best[0].getAccuracy()<=25f){
                    done[0]=true;
                    try{lm.removeUpdates(listener[0]);}catch(Exception ignored){}
                    sendLocation(tag,best[0],null);
                }
            }
            @Override public void onProviderEnabled(String p){}
            @Override public void onProviderDisabled(String p){}
            @Override public void onStatusChanged(String p,int status,Bundle extras){}
        };

        try{
            Location last=lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if(last!=null)best[0]=last;
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000L,0f,listener[0],Looper.getMainLooper());
            handler.postDelayed(()->{
                if(done[0])return;
                done[0]=true;
                try{lm.removeUpdates(listener[0]);}catch(Exception ignored){}
                if(best[0]!=null)sendLocation(tag,best[0],null);
                else sendLocation(tag,null,"Ainda não foi possível fixar o GPS. Vá para uma área aberta e toque em Atualizar GPS.");
            },60000L);
        }catch(SecurityException e){sendLocation(tag,null,"Permissão de localização não concedida.");}
        catch(Exception e){sendLocation(tag,best[0],best[0]==null?"Não foi possível iniciar o GPS.":null);}
    }

    private double score(Location l){
        double accuracy=l.hasAccuracy()?l.getAccuracy():9999d;
        double age=Math.max(0,System.currentTimeMillis()-l.getTime())/1000d;
        return -(accuracy+Math.min(age,3600d)/20d);
    }

    private void sendLocation(String tag,Location l,String error){
        try{
            JSONObject o=new JSONObject();
            o.put("ok",l!=null);
            if(l!=null){
                o.put("latitude",l.getLatitude());
                o.put("longitude",l.getLongitude());
                if(l.hasAccuracy())o.put("accuracy",l.getAccuracy());
                o.put("timestamp",l.getTime());
                o.put("provider","GPS");
                OfflineDb.get(this).putSetting("last_location",o.toString());
            }else o.put("error",error==null?"GPS indisponível.":error);
            evalJs("window.agroLocationResult && window.agroLocationResult("+JSONObject.quote(tag)+","+JSONObject.quote(o.toString())+");");
        }catch(Exception ignored){}
    }

    private void watchNetwork(){
        connectivityManager=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE);
        if(connectivityManager==null)return;
        networkCallback=new ConnectivityManager.NetworkCallback(){
            @Override public void onAvailable(Network network){
                if(OfflineDb.get(MainActivityV23.this).pendingCount()>0)SyncScheduler.schedule(MainActivityV23.this);
            }
        };
        try{connectivityManager.registerDefaultNetworkCallback(networkCallback);}catch(Exception ignored){}
    }

    @Override protected void onResume(){
        super.onResume();
        if(OfflineDb.get(this).pendingCount()>0)SyncScheduler.schedule(this);
    }

    @Override protected void onDestroy(){
        if(connectivityManager!=null&&networkCallback!=null){try{connectivityManager.unregisterNetworkCallback(networkCallback);}catch(Exception ignored){}}
        super.onDestroy();
    }
}
