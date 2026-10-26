import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const ids = {
  alice: "11111111-1111-4111-8111-111111111111",
  bob: "22222222-2222-4222-8222-222222222222",
  eve: "33333333-3333-4333-8333-333333333333",
};
test("Supabase migration enforces private messaging and abuse controls", async (t) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to authenticated,anon;
 grant select,insert,delete on storage.objects to authenticated;`);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610260001_loop.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const [name, id] of Object.entries(ids)) {
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [id, JSON.stringify({ display_name: name })],
    );
    await db.query("update profiles set username=$1 where id=$2", [name, id]);
  }
  const as = async (name) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      ids[name] || "",
    ]);
    await db.exec(name === "anon" ? "set role anon" : "set role authenticated");
  };
  let cid, message;
  await t.test(
    "anonymous clients cannot enumerate profiles or chats",
    async () => {
      await as("anon");
      await assert.rejects(
        db.query("select * from profiles"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select start_direct_chat($1)", [ids.bob]),
        /permission denied/,
      );
    },
  );
  await t.test(
    "search is bounded and does not reveal email or arbitrary profiles",
    async () => {
      await as("alice");
      assert.equal(
        (await db.query("select * from search_profiles($1)", ["bo"])).rows
          .length,
        0,
      );
      const rows = (
        await db.query("select * from search_profiles($1)", ["bob"])
      ).rows;
      assert.equal(rows[0].username, "bob");
      assert.equal("email" in rows[0], false);
      assert.equal(
        (await db.query("select * from profiles where id=$1", [ids.bob])).rows
          .length,
        0,
      );
    },
  );
  await t.test(
    "only participants can read and send; repeated starts reuse a chat",
    async () => {
      await as("alice");
      cid = (await db.query("select start_direct_chat($1) as id", [ids.bob]))
        .rows[0].id;
      assert.equal(
        (await db.query("select start_direct_chat($1) as id", [ids.bob]))
          .rows[0].id,
        cid,
      );
      message = (
        await db.query(
          "insert into messages(conversation_id,body) values($1,$2) returning *",
          [cid, "hello Bob"],
        )
      ).rows[0];
      assert.equal(message.sender_id, ids.alice);
      await as("bob");
      assert.equal((await db.query("select * from messages")).rows.length, 1);
      await as("eve");
      assert.equal((await db.query("select * from messages")).rows.length, 0);
      assert.equal(
        (await db.query("select * from conversation_members")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("insert into messages(conversation_id,body) values($1,$2)", [
          cid,
          "intrusion",
        ]),
        /row-level security/,
      );
    },
  );
  await t.test(
    "sender, timestamps, members and immutable message bodies cannot be forged",
    async () => {
      await as("alice");
      await assert.rejects(
        db.query(
          "insert into messages(conversation_id,body,sender_id) values($1,$2,$3)",
          [cid, "forged", ids.bob],
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into messages(conversation_id,body,created_at) values($1,$2,now())",
          [cid, "forged"],
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update messages set body=$1 where id=$2", [
          "changed",
          message.id,
        ]),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into conversation_members(conversation_id,user_id) values($1,$2)",
          [cid, ids.eve],
        ),
        /permission denied/,
      );
    },
  );
  await t.test(
    "private storage restricts upload and reads to the correct conversation",
    async () => {
      await as("alice");
      const path = `${ids.alice}/${cid}/photo.jpg`;
      await db.query(
        "insert into storage.objects(bucket_id,name) values($1,$2)",
        ["chat-media", path],
      );
      await db.query(
        "insert into messages(conversation_id,attachment_path) values($1,$2)",
        [cid, path],
      );
      await as("bob");
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        1,
      );
      await assert.rejects(
        db.query(
          "insert into messages(conversation_id,attachment_path) values($1,$2)",
          [cid, path],
        ),
        /row-level security/,
      );
      await as("eve");
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
          "chat-media",
          `${ids.eve}/${cid}/photo.jpg`,
        ]),
        /row-level security/,
      );
      await as("alice");
      await assert.rejects(
        db.query(
          "insert into messages(conversation_id,attachment_path) values($1,$2)",
          [cid, `${ids.alice}/${cid}/not-uploaded.jpg`],
        ),
        /row-level security/,
      );
    },
  );
  await t.test(
    "blocking stops messaging in both directions and hides user search",
    async () => {
      await as("bob");
      await db.query("insert into blocks(blocked_id) values($1)", [ids.alice]);
      for (const name of ["alice", "bob"]) {
        await as(name);
        await assert.rejects(
          db.query("insert into messages(conversation_id,body) values($1,$2)", [
            cid,
            "blocked",
          ]),
          /row-level security/,
        );
        assert.equal(
          (
            await db.query("select * from search_profiles($1)", [
              name === "alice" ? "bob" : "alice",
            ])
          ).rows.length,
          0,
        );
      }
      await as("bob");
      await db.query("delete from blocks where blocked_id=$1", [ids.alice]);
      await db.query(
        "insert into messages(conversation_id,body) values($1,$2)",
        [cid, "unblocked"],
      );
    },
  );
  await t.test(
    "reports cannot be read or resolved by users, and unrelated reports are rejected",
    async () => {
      await as("bob");
      await db.query(
        "insert into reports(reported_id,message_id,reason,details) values($1,$2,$3,$4)",
        [ids.alice, message.id, "harassment", "test report"],
      );
      await assert.rejects(
        db.query("select * from reports"),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into reports(reported_id,reason,status) values($1,'spam','resolved')",
          [ids.alice],
        ),
        /permission denied/,
      );
      await as("eve");
      await assert.rejects(
        db.query("insert into reports(reported_id,reason) values($1,'spam')", [
          ids.alice,
        ]),
        /row-level security/,
      );
    },
  );
  await t.test(
    "notification tokens are private and users cannot hijack a binding",
    async () => {
      await as("alice");
      const token = "test-device-token-1234567890";
      await db.query("insert into device_tokens(token) values($1)", [token]);
      await as("bob");
      assert.equal(
        (await db.query("select * from device_tokens")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("update device_tokens set user_id=$1 where token=$2", [
          ids.bob,
          token,
        ]),
        /permission denied/,
      );
      await db.query("delete from device_tokens where token=$1", [token]);
      await as("alice");
      assert.equal(
        (await db.query("select * from device_tokens")).rows.length,
        1,
      );
    },
  );
  await t.test("only authors can delete messages", async () => {
    await as("bob");
    await db.query("delete from messages where id=$1", [message.id]);
    assert.equal(
      (await db.query("select id from messages where id=$1", [message.id])).rows
        .length,
      1,
    );
    await as("alice");
    await db.query("delete from messages where id=$1", [message.id]);
    assert.equal(
      (await db.query("select id from messages where id=$1", [message.id])).rows
        .length,
      0,
    );
  });
  await t.test(
    "account deletion cascades authored messages and device tokens",
    async () => {
      await db.exec("reset role");
      await db.query("delete from auth.users where id=$1", [ids.alice]);
      assert.equal(
        (await db.query("select * from profiles where id=$1", [ids.alice])).rows
          .length,
        0,
      );
      assert.equal(
        (
          await db.query("select * from messages where sender_id=$1", [
            ids.alice,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query("select * from device_tokens where user_id=$1", [
            ids.alice,
          ])
        ).rows.length,
        0,
      );
    },
  );
  await db.close();
});
