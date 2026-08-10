package com.paf.gestaooperacional;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class SyncWorker extends Worker {
    public SyncWorker(@NonNull Context appContext,@NonNull WorkerParameters params){super(appContext,params);}

    @NonNull @Override public Result doWork(){
        try{
            OfflineDb db=OfflineDb.get(getApplicationContext());
            if(db.pendingCount()==0)return Result.success();
            if(!ApiClient.isOnline(getApplicationContext()))return Result.retry();

            // Sincronização automática: apenas envia o que foi coletado no aparelho.
            // A atualização/baixa da base continua sendo feita pelo botão Sincronizar,
            // evitando alterar a base local sem ação do usuário.
            org.json.JSONObject r=SyncEngine.syncAll(getApplicationContext(),null,false);
            return r.optInt("failed",0)==0?Result.success():Result.retry();
        }catch(ApiClient.ApiException e){
            return e.status==401?Result.failure():Result.retry();
        }catch(Exception e){
            return Result.retry();
        }
    }
}
