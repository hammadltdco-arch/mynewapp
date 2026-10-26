import {createClient} from 'npm:@supabase/supabase-js@2';
import {json} from '../_shared/http.ts';
const encode=(input:Uint8Array|string)=>btoa(typeof input==='string'?input:String.fromCharCode(...input)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function googleToken(service:{private_key:string;client_email:string}){
 const header=encode(JSON.stringify({alg:'RS256',typ:'JWT'})),now=Math.floor(Date.now()/1000);
 const claims=encode(JSON.stringify({iss:service.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
 const pem=service.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(`${header}.${claims}`)));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${header}.${claims}.${encode(signature)}`})});
 if(!response.ok)throw Error('Google token request failed');return (await response.json()).access_token;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=Deno.env.get('NOTIFICATION_WEBHOOK_SECRET');
 if(!secret||req.headers.get('Authorization')!==`Bearer ${secret}`)return json({error:'Unauthorized'},401);
 try{
  const payload=await req.json();
  if(payload.type!=='INSERT'||payload.schema!=='public'||payload.table!=='messages'||!payload.record?.id)return json({error:'Invalid event'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  // Re-read trusted DB state: never trust recipients or content supplied by a webhook body.
  const {data:m,error}=await db.from('messages').select('id,conversation_id,sender_id').eq('id',payload.record.id).single();if(error||!m)return json({error:'Message not found'},404);
  const {data:members,error:memberError}=await db.from('conversation_members').select('user_id').eq('conversation_id',m.conversation_id).neq('user_id',m.sender_id);if(memberError)throw memberError;
  const service=JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')||'null');if(!service?.project_id)throw Error('Push service is not configured');
  let access:string|null=null,delivered=0,failed=0;
  for(const recipient of members||[]){
   const {data:blocks,error:blockError}=await db.from('blocks').select('blocker_id').or(`and(blocker_id.eq.${m.sender_id},blocked_id.eq.${recipient.user_id}),and(blocker_id.eq.${recipient.user_id},blocked_id.eq.${m.sender_id})`);if(blockError)throw blockError;if(blocks?.length)continue;
   const {data:tokens,error:tokenError}=await db.from('device_tokens').select('token').eq('user_id',recipient.user_id);if(tokenError)throw tokenError;
   for(const {token} of tokens||[]){
    access??=await googleToken(service);
    const response=await fetch(`https://fcm.googleapis.com/v1/projects/${service.project_id}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token,notification:{title:'Loop Chat',body:'You have a new message.'},data:{conversation_id:m.conversation_id},android:{priority:'high',notification:{channel_id:'messages',tag:m.conversation_id}}}})});
    if(response.ok)delivered++;
    else{const failure=await response.json();if(failure.error?.details?.some((d:{errorCode?:string})=>d.errorCode==='UNREGISTERED')){const {error}=await db.from('device_tokens').delete().eq('token',token);if(error)throw error;}else failed++;}
   }
  }
  return json({delivered,failed},failed?502:200);
 }catch{console.error('Push delivery failed');return json({error:'Push delivery failed'},500)}
});
