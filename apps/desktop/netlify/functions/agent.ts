import { createClient } from '@supabase/supabase-js';
import { INSTRUCTIONS } from '../../../../packages/agent/src/orchestrator';
import type { Db, Role } from '../../../../packages/agent/src/registry';

export const config={path:'/api/agent'};
const json=(o:unknown,status=200)=>new Response(JSON.stringify(o),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const first=(m:string)=>`${m}-01`;
const rows=(r:any)=>{if(r.error)throw new Error(r.error.message);return r.data??[]};

type Message={role:'system'|'user'|'assistant'|'tool';content:string|null;tool_calls?:ToolCall[];tool_call_id?:string;name?:string};
type ToolCall={id:string;type:'function';function:{name:string;arguments:string}};
type Pending={messages:Message[];call:ToolCall;args:any};

const toolSchemas:Record<string,any>={
 search_students:{type:'object',properties:{course:{type:'string',description:'Course code such as DCA or ADCA'},name:{type:'string',description:'Student name'}},additionalProperties:false},
 get_pending_fees:{type:'object',properties:{month:{type:'string',pattern:'^\\d{4}-(0[1-9]|1[0-2])$'},course:{type:'string'}},required:['month'],additionalProperties:false},
 list_courses:{type:'object',properties:{},required:[],additionalProperties:false},
 list_batches:{type:'object',properties:{course:{type:'string'}},additionalProperties:false},
 record_fee:{type:'object',properties:{studentId:{type:'string'},month:{type:'string',pattern:'^\\d{4}-(0[1-9]|1[0-2])$'},amount:{type:'number',minimum:0},status:{type:'string',enum:['paid','pending']}},required:['studentId','month','amount','status'],additionalProperties:false},
 create_student:{type:'object',properties:{fullName:{type:'string',minLength:2},phone:{type:'string'},guardianPhone:{type:'string'},courseId:{type:'string'},batchId:{type:'string'},status:{type:'string',enum:['active','completed','paused','left']}},required:['fullName'],additionalProperties:false},
 update_student:{type:'object',properties:{studentId:{type:'string'},fullName:{type:'string'},phone:{type:'string'},guardianPhone:{type:'string'},courseId:{type:'string'},batchId:{type:'string'},status:{type:'string',enum:['active','completed','paused','left']}},required:['studentId'],additionalProperties:false},
 delete_student:{type:'object',properties:{studentId:{type:'string'}},required:['studentId'],additionalProperties:false},
 record_attendance:{type:'object',properties:{studentId:{type:'string'},day:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},status:{type:'string',enum:['present','absent','late','excused']}},required:['studentId','day','status'],additionalProperties:false},
 attendance_summary:{type:'object',properties:{studentId:{type:'string'},month:{type:'string',pattern:'^\\d{4}-(0[1-9]|1[0-2])$'}},required:['month'],additionalProperties:false},
 create_exam:{type:'object',properties:{courseId:{type:'string'},title:{type:'string',minLength:2},kind:{type:'string',enum:['mcq','practical','written']},totalMarks:{type:'number',integer:true,minimum:1},heldOn:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}},required:['title','kind'],additionalProperties:false},
 add_exam_question:{type:'object',properties:{examId:{type:'string'},body:{type:'string',minLength:2},options:{type:'array',items:{type:'string',minLength:1}},answer:{type:'string'},marks:{type:'number',integer:true,minimum:1}},required:['examId','body'],additionalProperties:false},
 record_exam_result:{type:'object',properties:{examId:{type:'string'},studentId:{type:'string'},marks:{type:'number',minimum:0}},required:['examId','studentId','marks'],additionalProperties:false}
};

const toolMeta:Record<string,{description:string;write:boolean}>= {
 search_students:{description:'Search students by name and/or course code.',write:false},
 get_pending_fees:{description:'List students with pending fees for a month.',write:false},
 list_courses:{description:'List BICA courses and their fees, durations and modules.',write:false},
 record_fee:{description:'Mark a monthly student fee paid or pending. Requires human confirmation.',write:true},
 create_student:{description:'Create a BICA student record. Requires human confirmation.',write:true},
 update_student:{description:'Update an existing BICA student record. Requires human confirmation.',write:true},
 delete_student:{description:'Remove an existing BICA student record. Requires human confirmation.',write:true},
 list_batches:{description:'List the available BICA student batches, optionally filtered by course code.',write:false},
 record_attendance:{description:'Record or correct one student attendance. Requires human confirmation.',write:true},
 attendance_summary:{description:'Get attendance percentage and records for a month.',write:false},
 create_exam:{description:'Create an exam for a BICA course. Requires human confirmation.',write:true},
 add_exam_question:{description:'Add a question to an exam. Requires human confirmation.',write:true},
 record_exam_result:{description:'Record a student exam mark. Requires human confirmation.',write:true}
};

function openRouterTools(){return Object.entries(toolSchemas).map(([name,parameters])=>({type:'function',function:{name,description:toolMeta[name].description,parameters}}));}
function clean(v:any){return v===null?undefined:v;}

export default async(req:Request)=>{
 if(req.method!=='POST')return json({type:'error',text:'POST only'},405);
 const {OPENROUTER_API_KEY,OPENROUTER_MODEL,SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_PUBLISHABLE_KEY}=process.env;
 const supabaseKey=SUPABASE_ANON_KEY||SUPABASE_PUBLISHABLE_KEY;
 if(!OPENROUTER_API_KEY||!SUPABASE_URL||!supabaseKey)return json({type:'error',text:'BICA server configuration is incomplete. Add OPENROUTER_API_KEY, SUPABASE_URL and a Supabase client key in Netlify Functions environment variables, then redeploy.'},500);
 const token=(req.headers.get('authorization')??'').replace(/^Bearer /,'');
 if(!token)return json({type:'error',text:'A BICA staff session is required.'},401);
 const c=createClient(SUPABASE_URL,supabaseKey,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:u}=await c.auth.getUser(token); if(!u.user)return json({type:'error',text:'Session expired.'},401);
 const prof=await c.from('profiles').select('full_name,role').eq('id',u.user.id).single();
 if(prof.error)return json({type:'error',text:'No BICA staff profile for this account.'},403);
 const role=prof.data.role as Role;
 const db:Db={
  async searchStudents({course,name}){let q=c.from('students').select('id,full_name,phone,guardian_phone,status,admitted_on,courses(id,code,name),batches(id,name)').limit(100);if(name)q=q.ilike('full_name',`%${name}%`);const l=rows(await q) as any[];return course?l.filter(r=>r.courses?.code?.toLowerCase()===course.toLowerCase()):l;},
  async pendingFees({month,course}){const l=rows(await c.from('fee_payments').select('id,student_id,month,amount,status,students(id,full_name,courses(code,name))').eq('month',first(month)).eq('status','pending')) as any[];return course?l.filter(r=>r.students?.courses?.code?.toLowerCase()===course.toLowerCase()):l;},
  async recordFee(a){const paid_on=a.status==='paid'?new Date().toISOString().slice(0,10):null;rows(await c.from('fee_payments').upsert({student_id:a.studentId,month:first(a.month),amount:a.amount,status:a.status,paid_on,recorded_by:u.user.id},{onConflict:'student_id,month'}));return rows(await c.from('fee_payments').select('student_id,month,amount,status,paid_on').eq('student_id',a.studentId).eq('month',first(a.month)).single());},
  async listCourses(){return rows(await c.from('courses').select('*').eq('active',true).order('code'));},
  async listBatches({course}){const l=rows(await c.from('batches').select('id,name,course_id,courses(code,name)').order('name')) as any[];return course?l.filter(r=>r.courses?.code?.toLowerCase()===course.toLowerCase()):l;},
  async createStudent(a){return rows(await c.from('students').insert({full_name:a.fullName,phone:a.phone,guardian_phone:a.guardianPhone,course_id:a.courseId,batch_id:a.batchId,status:a.status??'active'}).select().single());},
  async updateStudent(a){const{studentId,...patch}=a;return rows(await c.from('students').update(patch).eq('id',studentId).select().single());},
  async deleteStudent({studentId}){const existing=rows(await c.from('students').select('id,full_name').eq('id',studentId).single());rows(await c.from('students').delete().eq('id',studentId));return {deleted:true,student:existing};},
  async recordAttendance(a){return rows(await c.from('attendance').upsert({student_id:a.studentId,day:a.day,status:a.status},{onConflict:'student_id,day'}).select().single());},
  async attendanceSummary({studentId,month}){const start=first(month);const end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).toISOString().slice(0,10);let q=c.from('attendance').select('student_id,day,status').gte('day',start).lte('day',end);if(studentId)q=q.eq('student_id',studentId);const l=await rows(await q) as any[];const counts={present:0,absent:0,late:0,excused:0};for(const r of l)counts[r.status as keyof typeof counts]++;const counted=counts.present+counts.absent+counts.late;return{month,records:l,counts,percentage:counted?Math.round(((counts.present+counts.late)/counted)*10000)/100:0};},
  async createExam(a){return rows(await c.from('exams').insert({course_id:a.courseId,title:a.title,kind:a.kind,total_marks:a.totalMarks,held_on:a.heldOn}).select().single());},
  async addQuestion(a){return rows(await c.from('exam_questions').insert({exam_id:a.examId,body:a.body,options:a.options??null,answer:a.answer,marks:a.marks??1}).select().single());},
  async recordResult(a){return rows(await c.from('exam_results').upsert({exam_id:a.examId,student_id:a.studentId,marks:a.marks},{onConflict:'exam_id,student_id'}).select().single());}
 };
 const audit=async(a:any)=>{await c.from('agent_actions').insert({tool:a.tool,args:a.args,ok:a.ok,detail:a.detail});};
 const execute=async(name:string,args:any)=>{
  if(!toolMeta[name])throw new Error(`Unknown tool: ${name}`);
  if(!['owner','teacher'].includes(role))throw new Error('This staff role is not allowed to use BICA tools.');
  const normalized=Object.fromEntries(Object.entries(args??{}).map(([k,v])=>[k,clean(v)]));
  let out:any;
  switch(name){
   case 'search_students':out=await db.searchStudents(normalized);break;
   case 'get_pending_fees':out=await db.pendingFees(normalized);break;
   case 'list_courses':out=await db.listCourses();break;
   case 'list_batches':out=await db.listBatches(normalized);break;
   case 'record_fee':out=await db.recordFee(normalized);break;
   case 'create_student':out=await db.createStudent(normalized);break;
   case 'update_student':out=await db.updateStudent(normalized);break;
   case 'delete_student':out=await db.deleteStudent(normalized);break;
   case 'record_attendance':out=await db.recordAttendance(normalized);break;
   case 'attendance_summary':out=await db.attendanceSummary(normalized);break;
   case 'create_exam':out=await db.createExam(normalized);break;
   case 'add_exam_question':out=await db.addQuestion(normalized);break;
   case 'record_exam_result':out=await db.recordResult(normalized);break;
  }
  await audit({tool:name,args:normalized,ok:true,detail:'verified'});
  return out;
 };
 const callModel=async(messages:Message[])=>{
  const model=OPENROUTER_MODEL||'openrouter/free';
  const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${OPENROUTER_API_KEY}`,'HTTP-Referer':'https://bica-one.netlify.app','X-Title':'BICA ONE'},body:JSON.stringify({model,messages,tools:openRouterTools(),tool_choice:'auto',temperature:0.2})});
  const text=await r.text();let data:any;try{data=JSON.parse(text)}catch{throw new Error(`OpenRouter returned HTTP ${r.status}: ${text.slice(0,500)}`)}
  if(!r.ok)throw new Error(data?.error?.message||`OpenRouter request failed (HTTP ${r.status})`);
  return data?.choices?.[0]?.message;
 };
 try{
  const b=await req.json();
  let messages:Message[];
  let pending:Pending|undefined;
  if(typeof b.state==='string'){
   const parsed=JSON.parse(b.state) as {messages:Message[];pending:Pending}; messages=parsed.messages;pending=parsed.pending;
   if(!pending?.call)return json({type:'error',text:'Approval state is invalid. Please run the task again.'},400);
   if(b.approve!==true)return json({type:'final',text:'Action cancelled.'});
   const result=await execute(pending.call.function.name,pending.args);
   messages.push({role:'tool',tool_call_id:pending.call.id,name:pending.call.function.name,content:JSON.stringify(result)});
  }else{
   if(typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>8000)return json({type:'error',text:'Invalid prompt'},400);
   messages=[{role:'system',content:INSTRUCTIONS},{role:'user',content:b.prompt}];
  }
  for(let turn=0;turn<12;turn++){
   const msg=await callModel(messages);
   if(!msg)return json({type:'error',text:'The AI model returned an empty response.'},502);
   messages.push({role:'assistant',content:msg.content??null,tool_calls:msg.tool_calls});
   const calls:ToolCall[]=msg.tool_calls||[];
   if(!calls.length){return json({type:'final',text:String(msg.content||'No result returned.')});}
   for(const call of calls){
    let args:any={};try{args=JSON.parse(call.function.arguments||'{}')}catch{throw new Error(`Invalid arguments returned for ${call.function.name}.`)}
    if(toolMeta[call.function.name]?.write){
      const state=JSON.stringify({messages,pending:{messages,call,args}});
      return json({type:'confirm',state,tool:call.function.name,args:JSON.stringify(args,null,2)});
    }
    const result=await execute(call.function.name,args);
    messages.push({role:'tool',tool_call_id:call.id,name:call.function.name,content:JSON.stringify(result)});
   }
  }
  return json({type:'error',text:'The agent reached its maximum reasoning/tool turns. Please try a smaller task.'},500);
 }catch(e){const msg=e instanceof Error?e.message:String(e);console.error('BICA OpenRouter agent error',e);return json({type:'error',code:'AGENT_RUNTIME_ERROR',text:msg||'Agent runtime failed.'},500)}
};
