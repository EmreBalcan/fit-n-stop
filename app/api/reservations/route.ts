import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { reservations } from "../../../db/schema";
const today=()=>new Date().toISOString().slice(0,10);
export async function GET(request:Request){const memberId=Number(new URL(request.url).searchParams.get("memberId"));if(!memberId)return Response.json({reservation:null});const [reservation]=await getDb().select().from(reservations).where(and(eq(reservations.memberId,memberId),eq(reservations.date,today()))).limit(1);return Response.json({reservation:reservation??null});}
export async function POST(request:Request){const {memberId,timeSlot}=await request.json() as {memberId?:number;timeSlot?:string};if(!memberId||!timeSlot)return Response.json({error:"Eksik bilgi."},{status:400});await getDb().delete(reservations).where(and(eq(reservations.memberId,memberId),eq(reservations.date,today())));const [reservation]=await getDb().insert(reservations).values({memberId,date:today(),timeSlot,createdAt:new Date().toISOString()}).returning();return Response.json({reservation});}
export async function DELETE(request:Request){const memberId=Number(new URL(request.url).searchParams.get("memberId"));if(memberId)await getDb().delete(reservations).where(and(eq(reservations.memberId,memberId),eq(reservations.date,today())));return Response.json({success:true});}
