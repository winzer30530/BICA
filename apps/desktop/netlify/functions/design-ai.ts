import { createClient } from '@supabase/supabase-js';
const json=(o:unknown,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export default async(req:Request)=>{
 if(req.method!=="POST")return json({text:"POST only"},405);
 const {OPENROUTER_API_KEY,OPENROUTER_MODEL,SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_PUBLISHABLE_KEY}=process.env;
 const key=SUPABASE_ANON_KEY||SUPABASE_PUBLISHABLE_KEY;
 if(!OPENROUTER_API_KEY||!SUPABASE_URL||!key)return json({text:"Server environment is incomplete. Add OPENROUTER_API_KEY and Supabase variables."},500);
 const token=(req.headers.get("authorization")??"").replace(/^Bearer /,"");
 if(!token)return json({text:"A BICA staff session is required."},401);
 const c=createClient(SUPABASE_URL,key,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:u}=await c.auth.getUser(token); if(!u.user)return json({text:"Session expired."},401);
 const prof=await c.from("profiles").select("role").eq("id",u.user.id).single(); if(prof.error)return json({text:"No BICA staff profile for this account."},403);
 try{
  const body=await req.json();
  if(typeof body.image!=="string")return json({text:"Reference image is required."},400);
  const prompt=`Analyze this graphic-design reference for BICA ONE. Return JSON only with: width, height, background, text_layers (array of objects with name,text,x,y,size,role), visual_elements (array of strings), and design_notes (array of strings). Do not reproduce copyrighted logos or artwork; describe them instead. User brief: ${typeof body.brief==="string"?body.brief:""}`;
  const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${OPENROUTER_API_KEY}`,'HTTP-Referer':'https://bica-one.netlify.app','X-Title':'BICA ONE'},body:JSON.stringify({model:OPENROUTER_MODEL||"openrouter/free",messages:[{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:body.image}}]}],temperature:0.2,response_format:{type:"json_object"}})});
  const raw=await r.text();let data:any;try{data=JSON.parse(raw)}catch{throw new Error(`OpenRouter returned HTTP ${r.status}: ${raw.slice(0,500)}`)}
  if(!r.ok)throw new Error(data?.error?.message||`OpenRouter request failed (HTTP ${r.status})`);
  const content=data?.choices?.[0]?.message?.content||"{}";
  let plan:any;try{plan=typeof content==="string"?JSON.parse(content):content}catch{plan={design_notes:[String(content)]}}
  return json({plan});
 }catch(e){return json({text:e instanceof Error?e.message:String(e)},500)}
};
