package com.paf.gestaooperacional;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ProducerMediaClient {
    private static final String ROOT="https://salmon-woodcock-375027.hostingersite.com/";
    private static final Pattern GROUP=Pattern.compile("<div><b>(Fotos do produtor|Fotos de campo|Documentos)</b><small>.*?</small><section[^>]*>(.*?)</section></div>",Pattern.CASE_INSENSITIVE|Pattern.DOTALL);
    private static final Pattern LINK=Pattern.compile("<a\\s+href=[\"']download\\.php\\?id=(\\d+)[\"']([^>]*)>(.*?)</a>",Pattern.CASE_INSENSITIVE|Pattern.DOTALL);
    private static final Pattern TITLE=Pattern.compile("data-title=[\"']([^\"']+)[\"']",Pattern.CASE_INSENSITIVE);

    private ProducerMediaClient(){}

    public static JSONObject list(Context ctx,int producerId) throws Exception {
        if(producerId<=0)throw new IllegalStateException("Produtor inválido.");
        OfflineDb db=OfflineDb.get(ctx);
        String key="producer_media_list_"+producerId;
        if(ApiClient.isOnline(ctx)&&!db.getSetting("web_cookie","").isEmpty()){
            try{
                TextResponse r=text(ctx,"produtor.php?id="+producerId);
                if(r.code>=200&&r.code<400&&!r.body.contains("name=\"action\" value=\"login\"")){
                    JSONArray items=parse(r.body);
                    JSONObject out=new JSONObject().put("ok",true).put("producer_id",producerId).put("items",items).put("cached",false);
                    db.putSetting(key,out.toString());
                    return out;
                }
            }catch(Exception ignored){}
        }
        String cached=db.getSetting(key,"");
        if(!cached.isEmpty()){
            JSONObject out=new JSONObject(cached);out.put("cached",true);return out;
        }
        if(!ApiClient.isOnline(ctx))throw new IllegalStateException("Sem internet e sem arquivos deste produtor salvos no aparelho.");
        throw new IllegalStateException("Não foi possível carregar fotos e documentos deste produtor.");
    }

    public static JSONObject fileData(Context ctx,int fileId) throws Exception {
        CachedFile cf=getOrDownload(ctx,fileId);
        if(cf.file.length()>8L*1024*1024)throw new IllegalStateException("O arquivo é grande demais para visualizar dentro do aplicativo. Use Abrir arquivo.");
        byte[] bytes=readBytes(cf.file);
        String data="data:"+cf.mime+";base64,"+Base64.encodeToString(bytes,Base64.NO_WRAP);
        return new JSONObject().put("ok",true).put("id",fileId).put("mime",cf.mime).put("name",cf.name).put("data",data).put("cached",cf.cached);
    }

    public static void openFile(Activity activity,int fileId) throws Exception {
        CachedFile cf=getOrDownload(activity,fileId);
        Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".fileprovider",cf.file);
        Intent i=new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri,cf.mime);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
        try{activity.startActivity(i);}catch(Exception e){throw new IllegalStateException("Nenhum aplicativo instalado conseguiu abrir este arquivo.");}
    }

    private static JSONArray parse(String html) throws Exception {
        JSONArray out=new JSONArray();Matcher gm=GROUP.matcher(html==null?"":html);
        while(gm.find()){
            String label=clean(gm.group(1));String cat=label.toLowerCase(Locale.ROOT).contains("document")?"DOCUMENTO":(label.toLowerCase(Locale.ROOT).contains("campo")?"FOTO_CAMPO":"FOTO_PRODUTOR");
            Matcher lm=LINK.matcher(gm.group(2));
            while(lm.find()){
                int id=Integer.parseInt(lm.group(1));String attrs=lm.group(2),text=clean(lm.group(3));Matcher tm=TITLE.matcher(attrs);String name=tm.find()?clean(tm.group(1)):text;boolean pdf=attrs.toLowerCase(Locale.ROOT).contains("data-pdf=\"1\"")||name.toLowerCase(Locale.ROOT).endsWith(".pdf");
                JSONObject x=new JSONObject();x.put("id",id);x.put("categoria",cat);x.put("grupo",label);x.put("nome",name);x.put("pdf",pdf);out.put(x);
            }
        }
        return out;
    }

    private static CachedFile getOrDownload(Context ctx,int fileId) throws Exception {
        if(fileId<=0)throw new IllegalStateException("Arquivo inválido.");OfflineDb db=OfflineDb.get(ctx);String metaKey="producer_file_meta_"+fileId;String meta=db.getSetting(metaKey,"");
        if(!meta.isEmpty()){
            try{JSONObject m=new JSONObject(meta);File f=new File(m.optString("path",""));if(f.isFile())return new CachedFile(f,m.optString("mime","application/octet-stream"),m.optString("name","arquivo"),true);}catch(Exception ignored){}
        }
        if(!ApiClient.isOnline(ctx))throw new IllegalStateException("Este arquivo ainda não foi baixado neste aparelho e não está disponível offline.");
        BinaryResponse r=binary(ctx,"download.php?id="+fileId);if(r.code<200||r.code>=400||r.bytes.length==0)throw new IllegalStateException("Não foi possível baixar o arquivo.");
        File dir=new File(ctx.getFilesDir(),"producer_media");if(!dir.exists()&&!dir.mkdirs())throw new IllegalStateException("Não foi possível preparar o armazenamento local.");String ext=extensionFor(r.mime,r.name);File f=new File(dir,"produtor_"+fileId+ext);try(FileOutputStream out=new FileOutputStream(f)){out.write(r.bytes);}JSONObject m=new JSONObject().put("path",f.getAbsolutePath()).put("mime",r.mime).put("name",r.name);db.putSetting(metaKey,m.toString());return new CachedFile(f,r.mime,r.name,false);
    }

    private static TextResponse text(Context ctx,String path) throws Exception {
        HttpURLConnection c=open(ctx,path);c.setRequestProperty("Accept","text/html,*/*");int code=c.getResponseCode();InputStream in=code>=400?c.getErrorStream():c.getInputStream();byte[] b=readAll(in,4*1024*1024);String s=new String(b,StandardCharsets.UTF_8);c.disconnect();return new TextResponse(code,s);
    }

    private static BinaryResponse binary(Context ctx,String path) throws Exception {
        HttpURLConnection c=open(ctx,path);c.setRequestProperty("Accept","*/*");int code=c.getResponseCode();String mime=c.getContentType();if(mime==null||mime.isEmpty())mime="application/octet-stream";mime=mime.split(";",2)[0].trim();String name="arquivo";String cd=c.getHeaderField("Content-Disposition");if(cd!=null){Matcher m=Pattern.compile("filename=\"?([^\";]+)",Pattern.CASE_INSENSITIVE).matcher(cd);if(m.find())name=m.group(1);}InputStream in=code>=400?c.getErrorStream():c.getInputStream();byte[] b=readAll(in,20*1024*1024);c.disconnect();return new BinaryResponse(code,b,mime,name);
    }

    private static HttpURLConnection open(Context ctx,String path) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(ROOT+path).openConnection();c.setRequestMethod("GET");c.setConnectTimeout(20000);c.setReadTimeout(90000);c.setUseCaches(false);c.setRequestProperty("User-Agent","AgroDominium-Android/2.3");String cookie=OfflineDb.get(ctx).getSetting("web_cookie","");if(!cookie.isEmpty())c.setRequestProperty("Cookie",cookie);return c;
    }

    private static byte[] readAll(InputStream in,int max) throws Exception {if(in==null)return new byte[0];ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[32768];int n,total=0;while((n=in.read(buf))>0){total+=n;if(total>max)throw new IllegalStateException("Arquivo acima do limite de visualização do aplicativo.");out.write(buf,0,n);}return out.toByteArray();}
    private static byte[] readBytes(File f) throws Exception {try(java.io.FileInputStream in=new java.io.FileInputStream(f)){return readAll(in,9*1024*1024);}}
    private static String clean(String s){return s==null?"":s.replaceAll("<[^>]+>","").replace("🖼️","").replace("📄","").replace("📎","").replace("&amp;","&").replace("&nbsp;"," ").replace("&#039;","'").replace("&quot;","\"").trim();}
    private static String extensionFor(String mime,String name){String n=name==null?"":name.toLowerCase(Locale.ROOT);int p=n.lastIndexOf('.');if(p>=0&&n.length()-p<=6)return n.substring(p);if("application/pdf".equals(mime))return ".pdf";if("image/png".equals(mime))return ".png";if("image/webp".equals(mime))return ".webp";return ".jpg";}

    private static final class TextResponse{final int code;final String body;TextResponse(int c,String b){code=c;body=b;}}
    private static final class BinaryResponse{final int code;final byte[] bytes;final String mime;final String name;BinaryResponse(int c,byte[] b,String m,String n){code=c;bytes=b;mime=m;name=n;}}
    private static final class CachedFile{final File file;final String mime;final String name;final boolean cached;CachedFile(File f,String m,String n,boolean c){file=f;mime=m;name=n;cached=c;}}
}
