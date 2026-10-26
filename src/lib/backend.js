import { createClient } from "@supabase/supabase-js";
import { Capacitor, registerPlugin } from "@capacitor/core";
const Vault = registerPlugin("SessionVault");
const secureStorage = {
  async getItem(key) {
    return Capacitor.isNativePlatform()
      ? (await Vault.get({ key })).value
      : sessionStorage.getItem(key);
  },
  async setItem(key, value) {
    if (Capacitor.isNativePlatform()) await Vault.set({ key, value });
    else sessionStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (Capacitor.isNativePlatform()) await Vault.remove({ key });
    else sessionStorage.removeItem(key);
  },
};
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = configured
  ? createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          storage: secureStorage,
          flowType: "pkce",
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      },
    )
  : null;
export const legal = {
  support:
    import.meta.env.VITE_SUPPORT_EMAIL || "novapulsedigitalllc@gmail.com",
  privacy: import.meta.env.VITE_PRIVACY_URL || "",
  terms: import.meta.env.VITE_TERMS_URL || "",
  deletion: import.meta.env.VITE_DELETION_URL || "",
};
export const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};
export async function loadInbox(userId) {
  const memberships = unwrap(
    await supabase
      .from("conversation_members")
      .select("conversation_id,last_read_at")
      .eq("user_id", userId),
  );
  if (!memberships.length) return [];
  const ids = memberships.map((m) => m.conversation_id);
  const members = unwrap(
    await supabase
      .from("conversation_members")
      .select(
        "conversation_id,user_id,profiles(id,username,display_name,about)",
      )
      .in("conversation_id", ids)
      .neq("user_id", userId),
  );
  // One bounded query per conversation prevents a busy chat hiding other previews.
  return Promise.all(
    memberships.map(async (member) => {
      const peer = members.find(
        (m) => m.conversation_id === member.conversation_id,
      )?.profiles;
      const latest = unwrap(
        await supabase
          .from("messages")
          .select("id,body,sender_id,attachment_path,created_at")
          .eq("conversation_id", member.conversation_id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1),
      );
      const count = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", member.conversation_id)
        .neq("sender_id", userId)
        .gt("created_at", member.last_read_at);
      if (count.error) throw count.error;
      return {
        id: member.conversation_id,
        peer: peer || { display_name: "Deleted account", username: null },
        last: latest[0],
        unread: count.count || 0,
      };
    }),
  ).then((chats) =>
    chats.sort((a, b) =>
      (b.last?.created_at || "").localeCompare(a.last?.created_at || ""),
    ),
  );
}
export async function loadMessages(cid, before) {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", cid)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (before)
    q = q.or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`,
    );
  const rows = unwrap(await q).reverse();
  return Promise.all(
    rows.map(async (m) => ({
      ...m,
      image: m.attachment_path
        ? unwrap(
            await supabase.storage
              .from("chat-media")
              .createSignedUrl(m.attachment_path, 3600),
          ).signedUrl
        : null,
    })),
  );
}
export async function postMessage(cid, body, file) {
  let path = null;
  if (file) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      throw Error("Choose a JPEG, PNG, or WebP image under 5 MB.");
    const user = unwrap(await supabase.auth.getUser()).user;
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[file.type];
    path = `${user.id}/${cid}/${crypto.randomUUID()}.${ext}`;
    unwrap(
      await supabase.storage
        .from("chat-media")
        .upload(path, file, { contentType: file.type, upsert: false }),
    );
  }
  const result = await supabase
    .from("messages")
    .insert({ conversation_id: cid, body: body.trim(), attachment_path: path })
    .select()
    .single();
  if (result.error) {
    if (path) await supabase.storage.from("chat-media").remove([path]);
    throw result.error;
  }
  return result.data;
}
export async function deleteMessage(m) {
  unwrap(await supabase.from("messages").delete().eq("id", m.id));
  if (m.attachment_path)
    unwrap(
      await supabase.storage.from("chat-media").remove([m.attachment_path]),
    );
}
export async function unregisterPush() {
  const token = localStorage.getItem("loop.push-token");
  if (token && supabase) {
    unwrap(await supabase.from("device_tokens").delete().eq("token", token));
    localStorage.removeItem("loop.push-token");
    localStorage.removeItem("loop.push-user");
    if (Capacitor.isNativePlatform() && import.meta.env.VITE_PUSH_ENABLED === 'true') {
      const {PushNotifications} = await import('@capacitor/push-notifications');
      await PushNotifications.unregister();
      await PushNotifications.removeAllListeners();
    }
  }
}
