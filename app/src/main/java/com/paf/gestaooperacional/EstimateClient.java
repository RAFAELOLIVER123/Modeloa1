package com.paf.gestaooperacional;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class EstimateClient {
    private static final String ROOT = "https://salmon-woodcock-375027.hostingersite.com/";
    private EstimateClient() {}

    public static JSONObject sync(Context ctx, JSONObject payload, String photosJson) throws Exception {
        OfflineDb db = OfflineDb.get(ctx);
        String cookie = db.getSetting("web_cookie", "");
        String csrf = db.getSetting("web_csrf", "");
        if (cookie.isEmpty() || csrf.isEmpty()) throw new IllegalStateException("Faça login novamente com internet antes de enviar a estimativa.");

        Map<String,String> fields = new LinkedHashMap<>();
        fields.put("csrf", csrf);
        fields.put("payload", payload.toString());
        List<File> photos = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(photosJson == null ? "[]" : photosJson);
            for (int i=0;i<a.length();i++) {
                JSONObject o = a.optJSONObject(i);
                String path = o != null ? o.optString("path","") : a.optString(i,"");
                if (!path.isEmpty()) {
                    File f = new File(path);
                    if (f.isFile()) photos.add(f);
                }
            }
        } catch (Exception ignored) {}

        Response r = multipart(ctx, "estimativa_salvar.php", fields, photos);
        JSONObject j;
        try { j = new JSONObject(r.body); }
        catch (Exception e) { throw new IllegalStateException("A plataforma retornou uma resposta inválida ao salvar a estimativa."); }
        if (r.code < 200 || r.code >= 300 || !j.optBoolean("ok", false)) {
            throw new IllegalStateException(j.optString("error", "Não foi possível salvar a estimativa."));
        }
        return j;
    }

    private static Response multipart(Context ctx, String path, Map<String,String> fields, List<File> photos) throws Exception {
        OfflineDb db = OfflineDb.get(ctx);
        String boundary = "----AgroDominiumEstimativa" + System.currentTimeMillis();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (Map.Entry<String,String> e: fields.entrySet()) {
            write(body,"--"+boundary+"\r\nContent-Disposition: form-data; name=\""+e.getKey()+"\"\r\n\r\n"+(e.getValue()==null?"":e.getValue())+"\r\n");
        }
        for (File f: photos) {
            String mime = mime(f.getName());
            write(body,"--"+boundary+"\r\nContent-Disposition: form-data; name=\"fotos[]\"; filename=\""+f.getName()+"\"\r\nContent-Type: "+mime+"\r\n\r\n");
            try (FileInputStream in = new FileInputStream(f)) {
                byte[] buf = new byte[32768]; int n;
                while ((n=in.read(buf))>0) body.write(buf,0,n);
            }
            write(body,"\r\n");
        }
        write(body,"--"+boundary+"--\r\n");

        HttpURLConnection c = (HttpURLConnection)new URL(ROOT+path).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(20000);
        c.setReadTimeout(120000);
        c.setDoOutput(true);
        c.setUseCaches(false);
        c.setRequestProperty("User-Agent","AgroDominium-Android/2.2.6");
        c.setRequestProperty("Accept","application/json");
        c.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);
        String cookie = db.getSetting("web_cookie","");
        if (!cookie.isEmpty()) c.setRequestProperty("Cookie",cookie);
        byte[] bytes = body.toByteArray();
        c.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream os = c.getOutputStream()) { os.write(bytes); }
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        String text = read(in);
        c.disconnect();
        return new Response(code,text);
    }

    private static String mime(String n) {
        String x = n == null ? "" : n.toLowerCase();
        if (x.endsWith(".png")) return "image/png";
        if (x.endsWith(".webp")) return "image/webp";
        if (x.endsWith(".heic")) return "image/heic";
        if (x.endsWith(".heif")) return "image/heif";
        return "image/jpeg";
    }

    private static void write(ByteArrayOutputStream out,String s) throws Exception { out.write(s.getBytes(StandardCharsets.UTF_8)); }
    private static String read(InputStream in) throws Exception {
        if (in == null) return "";
        StringBuilder b = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8))) {
            String line; while ((line=r.readLine())!=null) b.append(line);
        }
        return b.toString();
    }
    private static final class Response { final int code; final String body; Response(int c,String b){code=c;body=b;} }
}