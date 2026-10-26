import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors,json } from '../_shared/http.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const header=req.headers.get('Authorization')||'';
 if(!header.startsWith('Bearer '))return json({error:'Sign in first'},401);
 const client=createClient(url,anon,{global:{headers:{Authorization:header}},auth:{persistSession:false}});
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return json({error:'Invalid session'},401);
 // Require reauthentication, checked by the server rather than trusting the UI.
 const last=Date.parse(user.last_sign_in_at||'');
 if(!last||Date.now()-last>5*60*1000)return json({error:'Confirm your password again before deleting your account.'},403);
 let payload;try{payload=await req.json()}catch{return json({error:'Invalid request'},400)}
 if(payload.confirm!=='DELETE')return json({error:'Confirmation required'},400);
 const admin=createClient(url,service,{auth:{persistSession:false}});
 try{
  const bucket=admin.storage.from('chat-media');
  const paths:string[]=[];
  async function walk(prefix:string){
   for(let offset=0;;offset+=100){
    const {data,error}=await bucket.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw error;
    for(const entry of data||[]){const path=`${prefix}/${entry.name}`;if(entry.id)paths.push(path);else await walk(path)}
    if(!data||data.length<100)break;
   }
  }
  await walk(user.id);
  for(let i=0;i<paths.length;i+=100){const {error}=await bucket.remove(paths.slice(i,i+100));if(error)throw error;}
  // SQL foreign keys cascade profiles, authored messages, memberships and tokens.
  const {error}=await admin.auth.admin.deleteUser(user.id,false);if(error)throw error;
  return json({deleted:true});
 }catch(error){console.error('Account deletion incomplete',error instanceof Error?error.name:'storage_or_auth_error');return json({error:'Deletion could not be completed. Please retry or contact support.'},500)}
});
