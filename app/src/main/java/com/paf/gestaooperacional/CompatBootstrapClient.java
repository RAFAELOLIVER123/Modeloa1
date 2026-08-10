package com.paf.gestaooperacional;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Compatibilidade com a plataforma web atual.
 *
 * A API móvel continua sendo a primeira fonte. Este cliente existe para montar
 * a base offline quando a API ainda não expõe todas as tabelas. Ele não exige
 * acesso ao campo.php, portanto funciona também para ADMIN/DIRETOR/GERENTE.
 */
public final class CompatBootstrapClient {
    private static final String ROOT="https://salmon-woodcock-375027.hostingersite.com/";
    private static final Pattern CSRF=Pattern.compile("name=[\"']csrf[\"'][^>]*value=[\"']([^\"']+)[\"']",Pattern.CASE_INSENSITIVE);
    private static final Pattern OPTION=Pattern.compile("<option([^>]*)value=[\"']?([0-9]+)[\"']?([^>]*)>(.*?)</option>",Pattern.CASE_INSENSITIVE|Pattern.DOTALL);

    private CompatBootstrapClient(){}

    public static boolean hasSession(Context ctx){
        return !OfflineDb.get(ctx).getSetting("web_cookie","").trim().isEmpty();
    }

    public static void login(Context ctx,String login,String password) throws Exception{
        OfflineDb db=OfflineDb.get(ctx);
        // descarta somente a sessão web antiga; a base offline e o token móvel permanecem.
        db.removeSetting("web_cookie");
        db.removeSetting("web_csrf");

        Response first=request(ctx,"GET","login.php",null,null,false);
        String csrf=extractCsrf(first.body);
        if(csrf.isEmpty())throw new IllegalStateException("Não foi possível preparar a sessão da plataforma.");

        Map<String,String> fields=new LinkedHashMap<>();
        fields.put("csrf",csrf);
        fields.put("action","login");
        fields.put("login",login);
        fields.put("senha",password);
        Response auth=request(ctx,"POST","action.php",form(fields).getBytes(StandardCharsets.UTF_8),"application/x-www-form-urlencoded; charset=utf-8",false);
        String loc=auth.location==null?"":auth.location;
        if(loc.contains("login.php")||loc.contains("erro="))throw new IllegalStateException("Usuário ou senha inválidos.");
        if(db.getSetting("web_cookie","").isEmpty())throw new IllegalStateException("A plataforma não criou a sessão de dados.");

        // ADMIN normalmente abre index.php; técnico pode abrir campo.php. Aceita os dois.
        String freshCsrf="";
        boolean authenticated=false;
        String[] pages={"index.php","index.php?page=dashboard","campo.php","produtores.php"};
        for(String page:pages){
            try{
                Response v=request(ctx,"GET",page,null,null,false);
                if(v.code>=400)continue;
                if(isLoginPage(v.body,v.location))continue;
                authenticated=true;
                String c=extractCsrf(v.body);
                if(!c.isEmpty()){freshCsrf=c;break;}
            }catch(Exception ignored){}
        }
        if(!authenticated)throw new IllegalStateException("A sessão foi criada, mas a plataforma não confirmou o acesso.");
        db.putSetting("web_csrf",freshCsrf.isEmpty()?csrf:freshCsrf);
    }

    public static JSONObject bootstrap(Context ctx,int groupId) throws Exception{
        if(!hasSession(ctx))throw new IllegalStateException("Faça login novamente com internet para atualizar a base deste aparelho.");
        OfflineDb db=OfflineDb.get(ctx);
        String start=dateOffset(-730),end=dateOffset(730);

        JSONObject webgeo=firstJson(ctx,new String[]{
                "webgeo_dados.php?visao=grupo",
                "webgeo_dados.php?visao=todos",
                "webgeo_dados.php"
        });
        JSONObject report=firstJson(ctx,new String[]{
                "relatorio_diario_dados.php?data_inicio="+start+"&data_fim="+end,
                "relatorio_diario_dados.php"
        });
        JSONObject map=firstJson(ctx,new String[]{
                "mapa_dados.php?inicio="+start+"&fim="+end,
                "mapa_dados.php"
        });
        JSONObject routes=firstJson(ctx,new String[]{
                "rotas_dados.php?inicio="+start+"&fim="+end,
                "rotas_dados.php"
        });

        String programHtml=firstHtml(ctx,new String[]{"index.php?page=programacao_form","index.php?page=programacoes","campo.php"});
        String checklistHtml=firstHtml(ctx,new String[]{"checklist_veiculo.php","index.php?page=checklist_veiculo"});

        JSONArray produtores=new JSONArray();
        JSONArray plantios=new JSONArray();
        Map<Integer,JSONObject> prodMap=new LinkedHashMap<>();
        JSONArray rows=arrayAny(webgeo,"rows","data","produtores");
        for(int i=0;i<rows.length();i++){
            JSONObject r=rows.optJSONObject(i);if(r==null)continue;
            int pid=optInt(r,"produtor_id","id_produtor","id");
            if(pid>0&&!prodMap.containsKey(pid)){
                JSONObject p=new JSONObject();
                p.put("id",pid);
                p.put("nome",opt(r,"produtor","nome_produtor","nome"));
                p.put("cpf",opt(r,"cpf","cpf_produtor"));
                p.put("cod_fornecedor",opt(r,"cod_fornecedor","codigo_fornecedor","codigo"));
                p.put("telefone",opt(r,"telefone","celular"));
                p.put("email",opt(r,"email"));
                p.put("cidade",opt(r,"cidade","municipio"));
                p.put("status_atual",opt(r,"status","status_atual"));
                prodMap.put(pid,p);
            }
            if(pid>0){
                JSONObject pl=new JSONObject(r.toString());
                int plid=optInt(r,"plantio_id","id_plantio");
                if(plid>0)pl.put("id",plid);
                pl.put("produtor_id",pid);
                pl.put("comunidade_nome",opt(r,"comunidade","comunidade_nome"));
                pl.put("tecnico_nome",opt(r,"tecnico","tecnico_nome"));
                pl.put("polo_sigla",opt(r,"polo","polo_sigla"));
                plantios.put(pl);
            }
        }
        for(JSONObject p:prodMap.values())produtores.put(p);

        JSONArray comunidades=arrayAny(webgeo,"communities","comunidades");
        if(comunidades.length()==0)comunidades=deriveNamed(rows,"comunidade_id",new String[]{"comunidade","comunidade_nome"},"nome");
        JSONArray polos=arrayAny(webgeo,"polos");
        if(polos.length()==0)polos=deriveNamed(rows,"polo_id",new String[]{"polo","polo_sigla"},"nome");

        JSONArray programas=new JSONArray();
        JSONArray rr=arrayAny(report,"rows","data","programacoes");
        for(int i=0;i<rr.length();i++){
            JSONObject r=rr.optJSONObject(i);if(r==null)continue;
            JSONObject p=new JSONObject(r.toString());
            p.put("tecnico_nome",opt(r,"tecnico","tecnico_nome"));
            p.put("tecnico_matricula",opt(r,"matricula","tecnico_matricula"));
            p.put("comunidade_nome",opt(r,"comunidade","comunidade_nome"));
            p.put("atividade_nome",opt(r,"atividade","atividade_nome"));
            p.put("polo_sigla",opt(r,"polo","polo_sigla"));
            p.put("placa",opt(r,"placa"));
            programas.put(p);
        }

        JSONArray pontos=arrayAny(map,"points","pontos");
        JSONArray equipe=arrayAny(map,"teams","equipe","usuarios");
        JSONArray sessoes=new JSONArray(),localizacoes=new JSONArray();
        JSONArray ra=arrayAny(routes,"routes","rotas");
        for(int i=0;i<ra.length();i++){
            JSONObject item=ra.optJSONObject(i);if(item==null)continue;
            JSONObject se=item.optJSONObject("session");if(se==null)se=item.optJSONObject("sessao");
            if(se!=null)sessoes.put(se);
            JSONArray pts=item.optJSONArray("points");if(pts==null)pts=item.optJSONArray("pontos");
            if(pts==null)continue;
            int sid=se==null?0:se.optInt("id");
            for(int j=0;j<pts.length();j++){
                JSONObject p=pts.optJSONObject(j);if(p==null)continue;
                JSONObject q=new JSONObject(p.toString());if(sid>0)q.put("sessao_id",sid);localizacoes.put(q);
            }
        }

        JSONArray atividades=parseSelect(programHtml,"atividade_id","nome");
        if(polos.length()==0)polos=parseSelect(programHtml,"polo_id","nome");
        JSONArray veiculos=parseVehicles(programHtml);
        if(veiculos.length()==0)veiculos=parseVehicles(checklistHtml);
        JSONArray checkItems=parseChecklistItems(checklistHtml);
        JSONArray aprovacoes=new JSONArray();
        for(int i=0;i<programas.length();i++){
            JSONObject p=programas.optJSONObject(i);String st=p==null?"":p.optString("status").toUpperCase(Locale.ROOT);
            if(st.equals("PENDENTE")||st.equals("PENDENTE_APROVACAO")||st.equals("ENVIADO"))aprovacoes.put(p);
        }

        JSONObject data=new JSONObject();
        data.put("polos",polos);data.put("comunidades",comunidades);data.put("atividades",atividades);data.put("veiculos",veiculos);
        data.put("checklist_veiculo_itens",checkItems);data.put("programacoes",programas);data.put("aprovacoes_programacoes",aprovacoes);
        data.put("produtores",produtores);data.put("plantios",plantios);data.put("pontos",pontos);data.put("equipe",equipe);
        data.put("sessoes",sessoes);data.put("localizacoes",localizacoes);data.put("checklists_veiculo",new JSONArray());data.put("checklists_pendentes",new JSONArray());data.put("movimentacoes_veiculos",new JSONArray());
        // As chaves dos módulos novos sempre existem. Se a API móvel já as expõe, o merge do SyncEngine mantém a versão mais completa.
        data.put("estimativas",new JSONArray());data.put("manutencao_itens",new JSONArray());data.put("manutencoes",new JSONArray());
        data.put("chat_conversas",new JSONArray());data.put("chat_mensagens",new JSONArray());

        JSONObject out=new JSONObject();out.put("ok",true);out.put("version","compatibilidade-web-2.3");out.put("server_time",new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.US).format(new Date()));
        out.put("group_id",groupId);out.put("user",json(db.getSetting("user_json","{}")));out.put("groups",array(db.getSetting("groups_json","[]")));out.put("data",data);out.put("modo_compatibilidade",true);
        return out;
    }

    private static JSONObject firstJson(Context ctx,String[] paths){
        for(String path:paths){try{JSONObject j=getJson(ctx,path);if(j!=null)return j;}catch(Exception ignored){}}
        return new JSONObject();
    }
    private static String firstHtml(Context ctx,String[] paths){
        for(String path:paths){try{Response r=request(ctx,"GET",path,null,null,false);if(r.code<400&&!isLoginPage(r.body,r.location)&&r.body!=null&&!r.body.isEmpty())return r.body;}catch(Exception ignored){}}
        return "";
    }
    private static JSONObject getJson(Context ctx,String path) throws Exception{
        Response r=request(ctx,"GET",path,null,null,false);if(r.code>=400||isLoginPage(r.body,r.location))throw new IllegalStateException("Sessão expirada.");
        JSONObject j=new JSONObject(r.body);if(j.has("ok")&&!j.optBoolean("ok",false))throw new IllegalStateException(j.optString("error","Falha ao baixar dados."));return j;
    }
    private static JSONArray arrayAny(JSONObject j,String...keys){for(String k:keys){JSONArray a=j==null?null:j.optJSONArray(k);if(a!=null)return a;}return new JSONArray();}
    private static String opt(JSONObject j,String...keys){for(String k:keys){String v=j.optString(k,"").trim();if(!v.isEmpty()&&!"null".equalsIgnoreCase(v))return v;}return "";}
    private static int optInt(JSONObject j,String...keys){for(String k:keys){int v=j.optInt(k,0);if(v>0)return v;}return 0;}
    private static JSONArray deriveNamed(JSONArray rows,String idKey,String[] nameKeys,String outputName) throws Exception{
        Map<String,JSONObject> m=new LinkedHashMap<>();
        for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);if(r==null)continue;String name=opt(r,nameKeys);if(name.isEmpty())continue;int id=r.optInt(idKey,0);String key=id>0?"id:"+id:"n:"+name.toLowerCase(Locale.ROOT);if(m.containsKey(key))continue;JSONObject o=new JSONObject();if(id>0)o.put("id",id);else o.put("id",-(m.size()+1));o.put(outputName,name);m.put(key,o);}JSONArray a=new JSONArray();for(JSONObject o:m.values())a.put(o);return a;
    }
    private static JSONArray parseSelect(String html,String name,String label) throws Exception{
        JSONArray a=new JSONArray();if(html==null||html.isEmpty())return a;
        Matcher sm=Pattern.compile("<select[^>]*(?:name|id)=[\"']"+Pattern.quote(name)+"[\"'][^>]*>(.*?)</select>",Pattern.CASE_INSENSITIVE|Pattern.DOTALL).matcher(html);if(!sm.find())return a;
        Matcher om=OPTION.matcher(sm.group(1));while(om.find()){int id=Integer.parseInt(om.group(2));String text=clean(om.group(4));if(id<=0||text.isEmpty())continue;JSONObject o=new JSONObject();o.put("id",id);o.put(label,text);a.put(o);}return a;
    }
    private static JSONArray parseVehicles(String html) throws Exception{
        JSONArray src=parseSelect(html,"veiculo_id","placa"),out=new JSONArray();for(int i=0;i<src.length();i++){JSONObject x=src.getJSONObject(i);JSONObject o=new JSONObject();o.put("id",x.optInt("id"));o.put("placa",x.optString("placa"));o.put("modelo",x.optString("placa"));out.put(o);}return out;
    }
    private static JSONArray parseChecklistItems(String html) throws Exception{
        JSONArray a=new JSONArray();if(html==null||html.isEmpty())return a;
        Pattern p=Pattern.compile("<div[^>]*class=[\"'][^\"']*(?:vc-row|check-item)[^\"']*[\"'][^>]*>.*?<b[^>]*>(.*?)</b>.*?name=[\"']item\\[(\\d+)\\][\"']",Pattern.CASE_INSENSITIVE|Pattern.DOTALL);
        Matcher m=p.matcher(html);while(m.find()){JSONObject o=new JSONObject();String raw=m.group(1);o.put("id",Integer.parseInt(m.group(2)));o.put("nome",clean(raw).replace("*","").trim());o.put("obrigatorio",raw.contains("*")?1:0);a.put(o);}return a;
    }

    private static boolean isLoginPage(String body,String location){String loc=location==null?"":location.toLowerCase(Locale.ROOT);if(loc.contains("login.php"))return true;String h=body==null?"":body.toLowerCase(Locale.ROOT);return h.contains("name=\"action\" value=\"login\"")||h.contains("name='action' value='login'")||(h.contains("id=\"loginpass\"")&&h.contains("senha"));}
    private static String extractCsrf(String html){Matcher m=CSRF.matcher(html==null?"":html);return m.find()?m.group(1):"";}
    private static String clean(String s){return s==null?"":s.replaceAll("<[^>]+>","").replace("&middot;","·").replace("&amp;","&").replace("&nbsp;"," ").replace("&#039;","'").replace("&quot;","\"").trim();}
    private static JSONObject json(String s){try{return new JSONObject(s);}catch(Exception e){return new JSONObject();}}
    private static JSONArray array(String s){try{return new JSONArray(s);}catch(Exception e){return new JSONArray();}}
    private static String dateOffset(int days){java.util.Calendar c=java.util.Calendar.getInstance();c.add(java.util.Calendar.DAY_OF_YEAR,days);return new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(c.getTime());}
    private static String form(Map<String,String> f) throws Exception{StringBuilder b=new StringBuilder();for(Map.Entry<String,String> e:f.entrySet()){if(b.length()>0)b.append('&');b.append(URLEncoder.encode(e.getKey(),"UTF-8")).append('=').append(URLEncoder.encode(e.getValue()==null?"":e.getValue(),"UTF-8"));}return b.toString();}

    private static Response request(Context ctx,String method,String path,byte[] body,String type,boolean follow) throws Exception{
        OfflineDb db=OfflineDb.get(ctx);HttpURLConnection c=(HttpURLConnection)new URL(ROOT+path).openConnection();c.setRequestMethod(method);c.setConnectTimeout(18000);c.setReadTimeout(70000);c.setInstanceFollowRedirects(follow);c.setRequestProperty("User-Agent","AgroDominium-Android/2.3");c.setRequestProperty("Accept","*/*");String cookie=db.getSetting("web_cookie","");if(!cookie.isEmpty())c.setRequestProperty("Cookie",cookie);
        if(body!=null){c.setDoOutput(true);if(type!=null)c.setRequestProperty("Content-Type",type);c.setFixedLengthStreamingMode(body.length);try(OutputStream os=c.getOutputStream()){os.write(body);}}
        int code=c.getResponseCode();captureCookies(db,c);String loc=c.getHeaderField("Location");InputStream in=code>=400?c.getErrorStream():c.getInputStream();String text=read(in);c.disconnect();return new Response(code,text,loc);
    }
    private static void captureCookies(OfflineDb db,HttpURLConnection c){
        Map<String,String> jar=new LinkedHashMap<>();String old=db.getSetting("web_cookie","");for(String p:old.split(";")){int e=p.indexOf('=');if(e>0)jar.put(p.substring(0,e).trim(),p.substring(e+1).trim());}
        Map<String,List<String>> headers=c.getHeaderFields();List<String> set=headers.get("Set-Cookie");if(set==null)set=headers.get("set-cookie");if(set!=null)for(String h:set){if(h==null)continue;String f=h.split(";",2)[0];int e=f.indexOf('=');if(e>0)jar.put(f.substring(0,e).trim(),f.substring(e+1).trim());}
        StringBuilder out=new StringBuilder();for(Map.Entry<String,String> e:jar.entrySet()){if(out.length()>0)out.append("; ");out.append(e.getKey()).append('=').append(e.getValue());}if(out.length()>0)db.putSetting("web_cookie",out.toString());
    }
    private static String read(InputStream in) throws Exception{if(in==null)return "";StringBuilder b=new StringBuilder();try(BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null)b.append(line).append('\n');}return b.toString();}
    private static final class Response{final int code;final String body;final String location;Response(int c,String b,String l){code=c;body=b;location=l;}}
}
