package com.paf.gestaooperacional;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.UUID;

public final class EstimateDraftStore {
    private static final String PREF = "agrodominium_estimativas";
    private static final String KEY = "rascunhos";

    private EstimateDraftStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    private static JSONArray read(Context ctx) {
        try { return new JSONArray(prefs(ctx).getString(KEY, "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    private static void write(Context ctx, JSONArray a) {
        prefs(ctx).edit().putString(KEY, a.toString()).apply();
    }

    public static synchronized JSONArray list(Context ctx) {
        return read(ctx);
    }

    public static synchronized JSONObject get(Context ctx, String uuid) {
        JSONArray a = read(ctx);
        for (int i = 0; i < a.length(); i++) {
            JSONObject d = a.optJSONObject(i);
            if (d != null && uuid.equals(d.optString("uuid"))) return d;
        }
        return null;
    }

    public static synchronized String save(Context ctx, String uuid, String payloadJson, String photosJson) throws Exception {
        if (uuid == null || uuid.trim().isEmpty()) uuid = UUID.randomUUID().toString();
        JSONObject payload = new JSONObject(payloadJson == null || payloadJson.isEmpty() ? "{}" : payloadJson);
        JSONArray photos = new JSONArray(photosJson == null || photosJson.isEmpty() ? "[]" : photosJson);
        JSONObject row = new JSONObject();
        row.put("uuid", uuid);
        row.put("payload", payload);
        row.put("photos", photos);
        row.put("updated_at", System.currentTimeMillis());

        JSONArray current = read(ctx);
        JSONArray out = new JSONArray();
        out.put(row);
        for (int i = 0; i < current.length(); i++) {
            JSONObject d = current.optJSONObject(i);
            if (d == null || uuid.equals(d.optString("uuid"))) continue;
            out.put(d);
            if (out.length() >= 100) break;
        }
        write(ctx, out);
        return uuid;
    }

    public static synchronized void delete(Context ctx, String uuid) {
        JSONArray current = read(ctx), out = new JSONArray();
        for (int i = 0; i < current.length(); i++) {
            JSONObject d = current.optJSONObject(i);
            if (d == null || uuid.equals(d.optString("uuid"))) continue;
            out.put(d);
        }
        write(ctx, out);
    }
}