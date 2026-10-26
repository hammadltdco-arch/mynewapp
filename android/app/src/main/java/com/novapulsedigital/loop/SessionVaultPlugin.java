package com.novapulsedigital.loop;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Auth sessions encrypted with a non-exportable Android Keystore key. No plaintext fallback. */
@CapacitorPlugin(name = "SessionVault")
public class SessionVaultPlugin extends Plugin {
    private static final String ALIAS = "loop.session.v1";
    private SharedPreferences prefs() { return getContext().getSharedPreferences("loop_sessions", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    @PluginMethod public synchronized void set(PluginCall call) {
        String name = call.getString("key"), value = call.getString("value");
        if (name == null || value == null) { call.reject("A key and value are required"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            String encrypted = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!prefs().edit().putString(name, encrypted).commit()) throw new Exception("Storage unavailable");
            call.resolve();
        } catch (Exception e) { call.reject("Could not securely store this session"); }
    }
    @PluginMethod public synchronized void get(PluginCall call) {
        String name = call.getString("key"); if (name == null) { call.reject("A key is required"); return; }
        try {
            String stored = prefs().getString(name, null); JSObject result = new JSObject();
            if (stored == null) { result.put("value", (String) null); call.resolve(result); return; }
            String[] parts = stored.split(":", 2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception e) { call.reject("Could not read this session. Clear app data and sign in again."); }
    }
    @PluginMethod public synchronized void remove(PluginCall call) {
        String name = call.getString("key"); if (name == null) { call.reject("A key is required"); return; }
        if (prefs().edit().remove(name).commit()) call.resolve(); else call.reject("Could not remove this session");
    }
}
