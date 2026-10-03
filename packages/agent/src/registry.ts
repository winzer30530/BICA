import { z } from 'zod';

export type Role = 'owner' | 'teacher';
export type Risk = 'read' | 'write' | 'destructive' | 'external';
export interface ToolContext { role: Role; db: Db; audit: (entry: { tool: string; args: unknown; ok: boolean; detail?: string }) => Promise<void>; }
export interface Db {
  searchStudents(q: { course?: string | null; name?: string | null }): Promise<unknown[]>;
  pendingFees(q: { month: string; course?: string | null }): Promise<unknown[]>;
  recordFee(q: { studentId: string; month: string; amount: number; status: 'paid' | 'pending' }): Promise<unknown>;
  listCourses(): Promise<unknown[]>;
  createStudent(q: { fullName:string; phone?:string | null; guardianPhone?:string | null; courseId?:string | null; batchId?:string | null; status?:'active'|'completed'|'paused'|'left' | null }): Promise<unknown>;
  updateStudent(q: { studentId:string; fullName?:string | null; phone?:string | null; guardianPhone?:string | null; courseId?:string | null; batchId?:string | null; status?:'active'|'completed'|'paused'|'left' | null }): Promise<unknown>;
  recordAttendance(q: { studentId:string; day:string; status:'present'|'absent'|'late'|'excused' }): Promise<unknown>;
  attendanceSummary(q: { studentId?:string | null; month:string }): Promise<unknown>;
  createExam(q: { courseId?:string | null; title:string; kind:'mcq'|'practical'|'written'; totalMarks?:number | null; heldOn?:string | null }): Promise<unknown>;
  addQuestion(q: { examId:string; body:string; options?:unknown; answer?:string | null; marks?:number | null }): Promise<unknown>;
  recordResult(q: { examId:string; studentId:string; marks:number }): Promise<unknown>;
}
const def = <S extends z.ZodObject<any>>(d: BicaToolDef<S>) => d;
export interface BicaToolDef<S extends z.ZodObject<any>> { name:string; description:string; risk:Risk; roles:Role[]; schema:S; run:(args:z.infer<S>,ctx:ToolContext)=>Promise<unknown>; }
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/,'Use YYYY-MM');
const status = z.enum(['active','completed','paused','left']);
export const toolDefs = [
 def({name:'search_students',description:'Search students by name and/or course code.',risk:'read',roles:['owner','teacher'],schema:z.object({course:z.string().nullable(),name:z.string().nullable()}),run:(a,c)=>c.db.searchStudents(a)}),
 def({name:'get_pending_fees',description:'List students with pending fees for a month.',risk:'read',roles:['owner','teacher'],schema:z.object({month,course:z.string().nullable()}),run:(a,c)=>c.db.pendingFees(a)}),
 def({name:'list_courses',description:'List BICA courses and their fees/durations/modules.',risk:'read',roles:['owner','teacher'],schema:z.object({}),run:(_,c)=>c.db.listCourses()}),
 def({name:'record_fee',description:'Mark a monthly student fee paid or pending. Requires confirmation.',risk:'write',roles:['owner','teacher'],schema:z.object({studentId:z.string().uuid(),month,amount:z.number().nonnegative(),status:z.enum(['paid','pending'])}),run:(a,c)=>c.db.recordFee(a)}),
 def({name:'create_student',description:'Create a BICA student record. Requires confirmation.',risk:'write',roles:['owner','teacher'],schema:z.object({fullName:z.string().min(2),phone:z.string().nullable(),guardianPhone:z.string().nullable(),courseId:z.string().uuid().nullable(),batchId:z.string().uuid().nullable(),status:status.nullable()}),run:(a,c)=>c.db.createStudent(a)}),
 def({name:'update_student',description:'Update an existing BICA student record. Requires confirmation.',risk:'write',roles:['owner','teacher'],schema:z.object({studentId:z.string().uuid(),fullName:z.string().min(2).nullable(),phone:z.string().nullable(),guardianPhone:z.string().nullable(),courseId:z.string().uuid().nullable(),batchId:z.string().uuid().nullable(),status:status.nullable()}),run:(a,c)=>c.db.updateStudent(a)}),
 def({name:'record_attendance',description:'Record or correct one student attendance. Requires confirmation.',risk:'write',roles:['owner','teacher'],schema:z.object({studentId:z.string().uuid(),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),status:z.enum(['present','absent','late','excused'])}),run:(a,c)=>c.db.recordAttendance(a)}),
 def({name:'attendance_summary',description:'Get attendance percentage and records for a month.',risk:'read',roles:['owner','teacher'],schema:z.object({studentId:z.string().uuid().nullable(),month}),run:(a,c)=>c.db.attendanceSummary(a)}),
 def({name:'create_exam',description:'Create an exam for a BICA course. Requires confirmation.',risk:'write',roles:['owner','teacher'],schema:z.object({courseId:z.string().uuid().nullable(),title:z.string().min(2),kind:z.enum(['mcq','practical','written']),totalMarks:z.number().int().positive().nullable(),heldOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()}),run:(a,c)=>c.db.createExam(a)}),
 def({name:'add_exam_question',description:'Add a question to an exam. Requires confirmation.',risk:'write',roles:['owner','teacher'],schema:z.object({examId:z.string().uuid(),body:z.string().min(2),options:z.array(z.string().min(1)).nullable(),answer:z.string().nullable(),marks:z.number().int().positive().nullable()}),run:(a,c)=>c.db.addQuestion(a)}),
 def({name:'record_exam_result',description:'Record a student exam marks. Requires confirmation.',risk:'write',roles:['owner','teacher'],schema:z.object({examId:z.string().uuid(),studentId:z.string().uuid(),marks:z.number().nonnegative()}),run:(a,c)=>c.db.recordResult(a)}),
] as const;
export function buildTools(_ctx:ToolContext){ return []; }
