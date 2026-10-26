import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase, unwrap } from "./backend";
export async function initNative({ onBack, onError }) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const listeners = [];
  await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  await Keyboard.setResizeMode({ mode: "body" }).catch(() => {});
  listeners.push(
    await App.addListener("backButton", async ({ canGoBack }) => {
      if (onBack()) return;
      if (canGoBack) window.history.back();
      else await App.minimizeApp();
    }),
  );
  listeners.push(
    await App.addListener("appStateChange", ({ isActive }) => {
      if (!supabase) return;
      if (isActive) {
        supabase.auth.startAutoRefresh();
        window.dispatchEvent(new Event("loop:refresh"));
      } else supabase.auth.stopAutoRefresh();
    }),
  );
  const consume = async (url) => {
    if (!supabase || !url) return;
    try {
      const u = new URL(url);
      const code = u.searchParams.get("code");
      if (!code) return;
      const id = (await App.getInfo()).id;
      if (u.protocol !== `${id}:` || u.hostname !== "auth-callback") return;
      unwrap(await supabase.auth.exchangeCodeForSession(code));
    } catch (e) {
      onError(e.message);
    }
  };
  listeners.push(await App.addListener("appUrlOpen", (e) => consume(e.url)));
  await consume((await App.getLaunchUrl())?.url);
  return () => listeners.forEach((l) => l.remove());
}
export async function authRedirect() {
  return Capacitor.isNativePlatform()
    ? `${(await App.getInfo()).id}://auth-callback`
    : `${location.origin}/`;
}
export async function enablePush(onOpen) {
  if (!Capacitor.isNativePlatform())
    throw Error("Notifications are available in the Android app.");
  if (import.meta.env.VITE_PUSH_ENABLED !== "true")
    throw Error("Push notifications are not configured for this build.");
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== "granted")
    permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted")
    throw Error(
      "Notifications were not allowed. You can change this in Android settings.",
    );
  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener("registration", async ({ value }) => {
    try {
      // Delete stale binding on this device before changing signed-in users.
      const result = await supabase
        .from("device_tokens")
        .insert({ token: value });
      if (result.error && result.error.code !== "23505") throw result.error;
      if (result.error) {
        const own = unwrap(
          await supabase
            .from("device_tokens")
            .select("token")
            .eq("token", value),
        );
        if (!own.length)
          throw Error(
            "This device is linked to another account. Sign out of that account first.",
          );
      }
      localStorage.setItem("loop.push-token", value);
    } catch (e) {
      onOpen({ error: e.message });
    }
  });
  await PushNotifications.addListener("registrationError", (e) =>
    onOpen({ error: e.error || "Notification registration failed." }),
  );
  await PushNotifications.addListener(
    "pushNotificationActionPerformed",
    ({ notification }) => onOpen(notification.data || {}),
  );
  await PushNotifications.register();
}
