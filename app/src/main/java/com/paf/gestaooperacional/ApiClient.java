package com.paf.gestaooperacional;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class ApiClient {
    public static final String BASE = "https://salmon-woodcock-375027.hostingersite.com/mobile/api.php";

    public static boolean isOnline(Context context) {
        try {
            ConnectivityManager cm=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if(cm==null)return false;
            Network n=cm.getActiveNetwork();
            if(n==null)return false;
            NetworkCapabilities c=cm.getNetworkCapabilities(n);
            if(c==null)return false;
            return c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch(Exception e) {
            return false;
        }
    }

    public static JSONObject login(String login,String password,String deviceId,String deviceName) throws Exception {
        JSONObject b=new JSONObject();b.put("login",login);b.put("password",password);b.put("device_id",deviceId);b.put("device_name",deviceName);
        return request("POST",BASE+"?action=login",null,b.toString());
    }

    public static JSONObject bootstrap(String token,int groupId) throws Exception {
        return request("GET",BASE+"?action=bootstrap&completo=1&group_id="+groupId,token,null);
    }

    public static JSONObject sync(String token,JSONObject operation) throws Exception { return request("POST",BASE+"?action=sync",token,operation.toString()); }
    public static JSONObject logout(String token) throws Exception { return request("POST",BASE+"?action=logout",token,"{}"); }
    public static JSONObject status() throws Exception { return request("GET",BASE+"?action=status",null,null); }

    private static JSONObject request(String method,String url,String token,String body) throws Exception {
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(url).openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(20000);
            c.setReadTimeout(180000);
            c.setUseCaches(false);
            c.setRequestProperty("Accept","application/json");
            c.setRequestProperty("Accept-Language","pt-BR,pt;q=0.9");
            c.setRequestProperty("User-Agent","AgroDominium-Android/2.2.1");
            if(token!=null&&!token.isEmpty())c.setRequestProperty("Authorization","Bearer "+token);
            if(body!=null){
                byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type","application/json; charset=utf-8");
                c.setFixedLengthStreamingMode(bytes.length);
                try(OutputStream os=c.getOutputStream()){os.write(bytes);}
            }
            int code=c.getResponseCode();
            InputStream in=code>=200&&code<400?c.getInputStream():c.getErrorStream();
            String text=readAll(in);
            JSONObject j;
            try{j=new JSONObject(text);}catch(Exception e){throw new IOException("O servidor respondeu em um formato inválido (HTTP "+code+").");}
            if(code<200||code>=300||!j.optBoolean("ok",false)){
                String err=j.optString("error","Falha de comunicação com o servidor (HTTP "+code+").");
                throw new ApiException(code,err);
            }
            return j;
        }finally{if(c!=null)c.disconnect();}
    }

    private static String readAll(InputStream in) throws IOException {
        if(in==null)return "";
        StringBuilder sb=new StringBuilder();
        try(BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null)sb.append(line);}
        return sb.toString();
    }

    public static class ApiException extends IOException {
        public final int status;
        public ApiException(int status,String message){super(message);this.status=status;}
    }
}
