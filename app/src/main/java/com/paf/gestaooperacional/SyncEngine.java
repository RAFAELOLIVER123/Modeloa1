package com.paf.gestaooperacional;

import android.content.Context;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.util.Locale;

public class SyncEngine {
    public interface Progress { void onProgress(int done,int total,String message); }

    public static JSONObject refresh(Context ctx,int requestedGroup) throws Exception {
        OfflineDb db=OfflineDb.get(ctx);
        String token=db.getSetting("token","");
        if(token.isEmpty())throw new IllegalStateException("Faça login com internet pelo menos uma vez neste aparelho.");
        int gid=requestedGroup>0?requestedGroup:parseInt(db.getSetting("group_id","0"));
        if(gid<=0)gid=1;
        JSONObject j;
        try{j=ApiClient.bootstrap(token,gid);}catch(Exception principal){if(!CompatClient.hasSession(ctx))throw principal;j=CompatClient.bootstrap(ctx,gid);}
        db.saveSnapshot(j.toString());
        db.putSetting("group_id",String.valueOf(j.optInt("group_id",gid)));
        if(j.has("user"))db.putSetting("user_json",j.getJSONObject("user").toString());
        if(j.has("groups"))db.putSetting("groups_json",j.getJSONArray("groups").toString());
        return j;
    }

    public static JSONObject syncAll(Context ctx,Progress progress,boolean refreshAfter) throws Exception {
        OfflineDb db=OfflineDb.get(ctx);db.resetSending();String token=db.getSetting("token","");
        if(token.isEmpty())throw new IllegalStateException("Sessão do aplicativo não configurada. Faça login novamente.");
        if(!ApiClient.isOnline(ctx))throw new IllegalStateException("Sem internet. Os dados continuam salvos no aparelho.");
        int totalInicial=db.pendingCount(),done=0,failed=0,processed=0;final int LIMITE_SEGURANCA=5000;
        while(processed<LIMITE_SEGURANCA){JSONArray pending=db.pending(300);if(pending.length()==0)break;boolean houveSucesso=false;
            for(int i=0;i<pending.length()&&processed<LIMITE_SEGURANCA;i++){
                JSONObject q=pending.getJSONObject(i);long id=q.getLong("id");db.markSending(id);String type=q.getString("type");processed++;
                try{
                    JSONObject payload=new JSONObject(q.optString("payload_json","{}"));if("route.sync".equals(type)){String ru=payload.optString("route_uuid",q.getString("client_uuid"));payload=db.buildRoutePayload(ru);}JSONObject response;
                    try{
                        JSONObject op=new JSONObject();op.put("client_uuid",q.getString("client_uuid"));op.put("type",type);op.put("group_id",q.optInt("group_id",parseInt(db.getSetting("group_id","0"))));JSONObject apiPayload=new JSONObject(payload.toString());
                        if("vehicle_checklist.create".equals(type)){String sigPath=apiPayload.optString("assinatura_path_local","");if(!sigPath.isEmpty()){apiPayload.remove("assinatura_path_local");apiPayload.put("assinatura_tecnico",encodeOneFile(sigPath,"assinatura-tecnico"));}}
                        op.put("payload",apiPayload);op.put("photos",encodePhotos(q.optString("photos_json","[]")));response=ApiClient.sync(token,op);
                    }catch(Exception apiError){if(!CompatClient.hasSession(ctx))throw apiError;response=CompatClient.syncOperation(ctx,type,payload,q.optString("photos_json","[]"));}
                    db.markSynced(id,response.toString());if("route.sync".equals(type))db.markRouteSynced(payload.optString("route_uuid",q.getString("client_uuid")));done++;houveSucesso=true;if(progress!=null)progress.onProgress(done,Math.max(totalInicial,done+db.pendingCount()),"Enviado: "+pretty(type));
                }catch(Exception e){failed++;String msg=e.getMessage()==null?e.toString():e.getMessage();db.markFailed(id,msg);if(progress!=null)progress.onProgress(done,Math.max(totalInicial,done+db.pendingCount()),"Falha em "+pretty(type)+": "+msg);if(e instanceof ApiClient.ApiException&&((ApiClient.ApiException)e).status==401)throw e;}
            }
            if(!houveSucesso)break;
        }
        db.purgeSynced();JSONObject fresh=null;if(refreshAfter&&db.pendingCount()==0){try{fresh=refresh(ctx,parseInt(db.getSetting("group_id","0")));}catch(Exception ignored){}}
        JSONObject out=new JSONObject();out.put("ok",db.pendingCount()==0);out.put("sincronizados",done);out.put("falhas",failed);out.put("pendentes",db.pendingCount());out.put("synced",done);out.put("failed",failed);out.put("pending",db.pendingCount());if(processed>=LIMITE_SEGURANCA)out.put("aviso","A fila é muito grande. Sincronize novamente para continuar.");if(fresh!=null)out.put("base_atualizada",true);return out;
    }

    private static JSONObject encodeOneFile(String path,String displayName) throws Exception{File f=new File(path);if(!f.isFile())throw new IllegalStateException("A assinatura salva no aparelho não foi encontrada.");byte[] b=readFile(f);JSONObject p=new JSONObject();p.put("name",displayName+extension(f.getName()));p.put("mime",mime(f.getName()));p.put("data",Base64.encodeToString(b,Base64.NO_WRAP));return p;}
    private static JSONArray encodePhotos(String json) throws Exception{JSONArray src;try{src=new JSONArray(json);}catch(Exception e){src=new JSONArray();}JSONArray out=new JSONArray();for(int i=0;i<src.length();i++){String path;JSONObject original=src.opt(i) instanceof JSONObject?src.optJSONObject(i):null;if(original!=null)path=original.optString("path","");else path=src.optString(i,"");if(path.isEmpty())continue;File f=new File(path);if(!f.isFile())throw new IllegalStateException("Uma foto salva no aparelho não foi encontrada: "+new File(path).getName());byte[] b=readFile(f);JSONObject p=new JSONObject();p.put("name",f.getName());p.put("mime",mime(f.getName()));p.put("data",Base64.encodeToString(b,Base64.NO_WRAP));if(original!=null&&original.has("categoria"))p.put("categoria",original.optString("categoria"));out.put(p);}return out;}
    private static byte[] readFile(File f) throws Exception{long len=f.length();if(len>12L*1024*1024)throw new IllegalStateException("O arquivo "+f.getName()+" ultrapassa 12 MB.");byte[] b=new byte[(int)len];try(FileInputStream in=new FileInputStream(f)){int off=0,n;while(off<b.length&&(n=in.read(b,off,b.length-off))>0)off+=n;if(off!=b.length)throw new IllegalStateException("Não foi possível ler um arquivo salvo no aparelho.");}return b;}
    private static String extension(String n){int i=n.lastIndexOf('.');return i>=0?n.substring(i):".jpg";}
    private static String mime(String n){String x=n.toLowerCase(Locale.ROOT);if(x.endsWith(".png"))return "image/png";if(x.endsWith(".webp"))return "image/webp";if(x.endsWith(".heic"))return "image/heic";return "image/jpeg";}
    private static String pretty(String type){if("programacao.create".equals(type))return "programação";if("programacao.approval".equals(type))return "aprovação da programação";if("ponto.create".equals(type))return "ponto de campo";if("route.sync".equals(type))return "rota GPS";if("vehicle_checklist.create".equals(type))return "checklist do veículo";if("vehicle_checklist.approval".equals(type))return "aprovação do checklist";if("vehicle_checklist.odometer_final".equals(type))return "odômetro final";return "registro de campo";}
    private static int parseInt(String s){try{return Integer.parseInt(s);}catch(Exception e){return 0;}}
}
