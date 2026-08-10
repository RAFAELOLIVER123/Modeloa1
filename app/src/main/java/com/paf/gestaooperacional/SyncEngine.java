package com.paf.gestaooperacional;

import android.content.Context;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.util.Iterator;
import java.util.Locale;

public class SyncEngine {
    public interface Progress { void onProgress(int done,int total,String message); }

    public static JSONObject refresh(Context ctx,int requestedGroup) throws Exception {
        OfflineDb db=OfflineDb.get(ctx);
        String token=db.getSetting("token","");
        if(token.isEmpty())throw new IllegalStateException("Faça login com internet pelo menos uma vez neste aparelho.");
        int gid=requestedGroup>0?requestedGroup:parseInt(db.getSetting("group_id","0"));
        if(gid<=0)gid=1;

        JSONObject api=null,compat=null;
        Exception apiError=null,compatError=null;
        try{api=ApiClient.bootstrap(token,gid);}catch(Exception e){apiError=e;}
        if(CompatBootstrapClient.hasSession(ctx)){
            try{compat=CompatBootstrapClient.bootstrap(ctx,gid);}catch(Exception e){compatError=e;}
        }

        JSONObject j=mergeSnapshots(api,compat,gid);
        if(!hasUsefulData(j)){
            String a=apiError==null?"API sem dados":safe(apiError.getMessage());
            String c=compatError==null?(CompatBootstrapClient.hasSession(ctx)?"sessão web sem dados":"sessão web não disponível"):safe(compatError.getMessage());
            throw new IllegalStateException("Não foi possível montar a base do aplicativo. "+a+" · "+c);
        }

        db.saveSnapshot(j.toString());
        db.putSetting("group_id",String.valueOf(j.optInt("group_id",gid)));
        if(j.has("user"))db.putSetting("user_json",j.getJSONObject("user").toString());
        if(j.has("groups"))db.putSetting("groups_json",j.getJSONArray("groups").toString());
        return j;
    }

    public static boolean hasUsefulDataString(String json){
        if(json==null||json.trim().isEmpty())return false;
        try{return hasUsefulData(new JSONObject(json));}catch(Exception e){return false;}
    }

    public static boolean hasUsefulData(JSONObject j){
        if(j==null)return false;
        JSONObject d=j.optJSONObject("data");if(d==null)return false;
        int total=0,core=0;
        String[] keys={"produtores","plantios","comunidades","atividades","polos","veiculos","programacoes","equipe","pontos"};
        for(String k:keys){
            JSONArray a=d.optJSONArray(k);
            if(a!=null){
                total+=a.length();
                if(a.length()>0&&("produtores".equals(k)||"comunidades".equals(k)||"atividades".equals(k)||"veiculos".equals(k)||"programacoes".equals(k)))core++;
            }
        }
        return total>0 && core>0;
    }

    public static JSONObject counts(JSONObject j){
        JSONObject out=new JSONObject();
        try{
            JSONObject d=j==null?null:j.optJSONObject("data");if(d==null)return out;
            String[] keys={"produtores","plantios","comunidades","atividades","polos","veiculos","programacoes","pontos","equipe","sessoes","localizacoes","checklist_veiculo_itens","aprovacoes_programacoes","checklists_pendentes","estimativas","levantamentos","manutencoes","manutencao_solicitacoes","chat_conversas","chat_mensagens"};
            for(String k:keys){JSONArray a=d.optJSONArray(k);out.put(k,a==null?0:a.length());}
        }catch(Exception ignored){}
        return out;
    }

    private static JSONObject mergeSnapshots(JSONObject api,JSONObject compat,int gid) throws JSONException {
        if(api==null&&compat==null)return null;
        JSONObject out=new JSONObject();
        JSONObject base=api!=null?api:compat;
        Iterator<String> top=base.keys();
        while(top.hasNext()){String k=top.next();if(!"data".equals(k))out.put(k,base.opt(k));}
        out.put("ok",true);out.put("group_id",gid);
        if((!out.has("user")||out.optJSONObject("user")==null)&&compat!=null&&compat.has("user"))out.put("user",compat.opt("user"));
        if((!out.has("groups")||out.optJSONArray("groups")==null)&&compat!=null&&compat.has("groups"))out.put("groups",compat.opt("groups"));

        JSONObject da=api==null?null:api.optJSONObject("data");
        JSONObject dc=compat==null?null:compat.optJSONObject("data");
        JSONObject d=new JSONObject();
        java.util.LinkedHashSet<String> keys=new java.util.LinkedHashSet<>();
        if(da!=null){Iterator<String> it=da.keys();while(it.hasNext())keys.add(it.next());}
        if(dc!=null){Iterator<String> it=dc.keys();while(it.hasNext())keys.add(it.next());}
        String[] expected={
                "polos","comunidades","atividades","veiculos","checklist_veiculo_itens",
                "programacoes","aprovacoes_programacoes","produtores","plantios","pontos","equipe",
                "sessoes","localizacoes","checklists_veiculo","checklists_pendentes","movimentacoes_veiculos",
                "estimativas","levantamentos","manutencao_itens","manutencao_moto_itens","manutencoes",
                "manutencao_solicitacoes","manutencao_moto_solicitacoes","chat_conversas","chat_membros","chat_mensagens"
        };
        for(String k:expected)keys.add(k);

        for(String k:keys){
            Object a=da==null?null:da.opt(k),c=dc==null?null:dc.opt(k);
            if(a instanceof JSONArray || c instanceof JSONArray){
                JSONArray aa=a instanceof JSONArray?(JSONArray)a:new JSONArray();
                JSONArray cc=c instanceof JSONArray?(JSONArray)c:new JSONArray();
                d.put(k,aa.length()>=cc.length()?aa:cc);
            }else if(a!=null&&a!=JSONObject.NULL)d.put(k,a);
            else if(c!=null&&c!=JSONObject.NULL)d.put(k,c);
            else d.put(k,new JSONArray());
        }
        out.put("data",d);
        out.put("modo_compatibilidade",compat!=null);
        return out;
    }

    public static JSONObject syncAll(Context ctx,Progress progress,boolean refreshAfter) throws Exception {
        OfflineDb db=OfflineDb.get(ctx);db.resetSending();String token=db.getSetting("token","");
        if(token.isEmpty())throw new IllegalStateException("Sessão do aplicativo não configurada. Faça login novamente.");
        if(!ApiClient.isOnline(ctx))throw new IllegalStateException("Sem internet. Os dados continuam salvos no aparelho.");
        int totalInicial=db.pendingCount(),done=0,failed=0,processed=0;final int LIMITE_SEGURANCA=5000;
        while(processed<LIMITE_SEGURANCA){
            JSONArray pending=db.pending(300);if(pending.length()==0)break;boolean houveSucesso=false;
            for(int i=0;i<pending.length()&&processed<LIMITE_SEGURANCA;i++){
                JSONObject q=pending.getJSONObject(i);long id=q.getLong("id");db.markSending(id);String type=q.getString("type");processed++;
                try{
                    JSONObject payload=new JSONObject(q.optString("payload_json","{}"));
                    if("route.sync".equals(type)){String ru=payload.optString("route_uuid",q.getString("client_uuid"));payload=db.buildRoutePayload(ru);}
                    JSONObject response;
                    if("estimativa.save".equals(type)){
                        response=EstimateClient.sync(ctx,payload,q.optString("photos_json","[]"));
                    }else{
                        try{
                            JSONObject op=new JSONObject();
                            op.put("client_uuid",q.getString("client_uuid"));
                            op.put("type",type);
                            op.put("group_id",q.optInt("group_id",parseInt(db.getSetting("group_id","0"))));
                            JSONObject apiPayload=new JSONObject(payload.toString());
                            if("vehicle_checklist.create".equals(type)){
                                String sigPath=apiPayload.optString("assinatura_path_local","");
                                if(!sigPath.isEmpty()){
                                    apiPayload.remove("assinatura_path_local");
                                    apiPayload.put("assinatura_tecnico",encodeOneFile(sigPath,"assinatura-tecnico"));
                                }
                            }
                            op.put("payload",apiPayload);
                            op.put("photos",encodeFiles(q.optString("photos_json","[]")));
                            response=ApiClient.sync(token,op);
                        }catch(Exception apiError){
                            // O fallback web antigo continua atendendo apenas os fluxos legados.
                            if(!CompatClient.hasSession(ctx))throw apiError;
                            response=CompatClient.syncOperation(ctx,type,payload,q.optString("photos_json","[]"));
                        }
                    }
                    db.markSynced(id,response.toString());
                    if("route.sync".equals(type))db.markRouteSynced(payload.optString("route_uuid",q.getString("client_uuid")));
                    done++;houveSucesso=true;
                    if(progress!=null)progress.onProgress(done,Math.max(totalInicial,done+db.pendingCount()),"Enviado: "+pretty(type));
                }catch(Exception e){
                    failed++;String msg=e.getMessage()==null?e.toString():e.getMessage();db.markFailed(id,msg);
                    if(progress!=null)progress.onProgress(done,Math.max(totalInicial,done+db.pendingCount()),"Falha em "+pretty(type)+": "+msg);
                    if(e instanceof ApiClient.ApiException&&((ApiClient.ApiException)e).status==401)throw e;
                }
            }
            if(!houveSucesso)break;
        }
        db.purgeSynced();

        JSONObject fresh=null;String baseError="";
        if(refreshAfter){
            try{fresh=refresh(ctx,parseInt(db.getSetting("group_id","0")));}
            catch(Exception e){baseError=e.getMessage()==null?"Não foi possível atualizar a base.":e.getMessage();}
        }

        JSONObject out=new JSONObject();
        boolean baseOk=!refreshAfter || fresh!=null;
        out.put("ok",baseOk && failed==0);
        out.put("sincronizados",done);out.put("falhas",failed);out.put("pendentes",db.pendingCount());
        out.put("synced",done);out.put("failed",failed);out.put("pending",db.pendingCount());
        if(processed>=LIMITE_SEGURANCA)out.put("aviso","A fila é muito grande. Sincronize novamente para continuar.");
        if(fresh!=null){out.put("base_atualizada",true);out.put("contagens",counts(fresh));}
        if(!baseError.isEmpty())out.put("erro_base",baseError);
        if(fresh!=null&&failed>0)out.put("message","A base foi atualizada, mas alguns envios continuam pendentes.");
        else if(fresh!=null)out.put("message","Sincronização concluída. Dados enviados e bases atualizadas.");
        else if(done>0)out.put("message","Coletas enviadas, mas a base não pôde ser atualizada.");
        else if(!baseError.isEmpty())out.put("error",baseError);
        return out;
    }

    private static JSONObject encodeOneFile(String path,String displayName) throws Exception{
        File f=new File(path);if(!f.isFile())throw new IllegalStateException("O arquivo salvo no aparelho não foi encontrado.");
        byte[] b=readFile(f);JSONObject p=new JSONObject();p.put("name",displayName+extension(f.getName()));p.put("mime",mime(f.getName()));p.put("data",Base64.encodeToString(b,Base64.NO_WRAP));return p;
    }

    private static JSONArray encodeFiles(String json) throws Exception{
        JSONArray src;try{src=new JSONArray(json);}catch(Exception e){src=new JSONArray();}
        JSONArray out=new JSONArray();
        for(int i=0;i<src.length();i++){
            String path;JSONObject original=src.opt(i) instanceof JSONObject?src.optJSONObject(i):null;
            if(original!=null)path=original.optString("path","");else path=src.optString(i,"");
            if(path.isEmpty())continue;
            File f=new File(path);if(!f.isFile())throw new IllegalStateException("Um arquivo salvo no aparelho não foi encontrado: "+new File(path).getName());
            byte[] b=readFile(f);JSONObject p=new JSONObject();p.put("name",f.getName());p.put("mime",mime(f.getName()));p.put("data",Base64.encodeToString(b,Base64.NO_WRAP));
            if(original!=null){
                if(original.has("categoria"))p.put("categoria",original.optString("categoria"));
                if(original.has("duracao_segundos"))p.put("duracao_segundos",original.optDouble("duracao_segundos"));
                if(original.has("tipo"))p.put("tipo",original.optString("tipo"));
            }
            out.put(p);
        }
        return out;
    }

    private static byte[] readFile(File f) throws Exception{
        long len=f.length();if(len>25L*1024*1024)throw new IllegalStateException("O arquivo "+f.getName()+" ultrapassa 25 MB.");
        byte[] b=new byte[(int)len];try(FileInputStream in=new FileInputStream(f)){int off=0,n;while(off<b.length&&(n=in.read(b,off,b.length-off))>0)off+=n;if(off!=b.length)throw new IllegalStateException("Não foi possível ler um arquivo salvo no aparelho.");}return b;
    }
    private static String extension(String n){int i=n.lastIndexOf('.');return i>=0?n.substring(i):".jpg";}
    private static String mime(String n){
        String x=n.toLowerCase(Locale.ROOT);
        if(x.endsWith(".png"))return "image/png";
        if(x.endsWith(".webp"))return "image/webp";
        if(x.endsWith(".heic"))return "image/heic";
        if(x.endsWith(".pdf"))return "application/pdf";
        if(x.endsWith(".m4a")||x.endsWith(".mp4"))return "audio/mp4";
        if(x.endsWith(".aac"))return "audio/aac";
        if(x.endsWith(".mp3"))return "audio/mpeg";
        if(x.endsWith(".wav"))return "audio/wav";
        if(x.endsWith(".ogg"))return "audio/ogg";
        return "image/jpeg";
    }
    private static String pretty(String type){
        if("programacao.create".equals(type))return "programação";
        if("programacao.approval".equals(type))return "aprovação da programação";
        if("ponto.create".equals(type))return "ponto de campo";
        if("route.sync".equals(type))return "rota GPS";
        if("vehicle_checklist.create".equals(type))return "checklist do veículo";
        if("vehicle_checklist.approval".equals(type))return "aprovação do checklist";
        if("vehicle_checklist.odometer_final".equals(type))return "odômetro final";
        if("estimativa.save".equals(type))return "estimativa de produção";
        if("maintenance.request".equals(type))return "solicitação de manutenção";
        if("maintenance.decision".equals(type))return "decisão da manutenção";
        if("chat.message".equals(type))return "mensagem do chat";
        if("chat.conversation".equals(type))return "conversa do chat";
        return "registro de campo";
    }
    private static int parseInt(String s){try{return Integer.parseInt(s);}catch(Exception e){return 0;}}
    private static String safe(String s){return s==null||s.trim().isEmpty()?"falha sem detalhes":s.trim();}
}
