package com.paf.gestaooperacional;

import android.content.Context;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

public class SyncScheduler {
    public static void schedule(Context c){
        Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        OneTimeWorkRequest req=new OneTimeWorkRequest.Builder(SyncWorker.class).setConstraints(constraints).build();
        WorkManager.getInstance(c).enqueueUniqueWork("agrodominium-sync", ExistingWorkPolicy.KEEP,req);
    }
}
