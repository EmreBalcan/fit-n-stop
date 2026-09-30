import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { closedDays, reservations } from "../../../db/schema";

export async function GET(){return Response.json({closedDays:await getDb().select().from(closedDays)});}
export async function POST(request:Request){
  const {date,reason}=await request.json() as {date?:string;reason?:string};
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return Response.json({error:"Geçerli bir tarih seçin."},{status:400});
  await getDb().delete(reservations).where(eq(reservations.date,date));
  await getDb().insert(closedDays).values({date,reason:reason?.trim()||"Salon kapalı",createdAt:new Date().toISOString()}).onConflictDoUpdate({target:closedDays.date,set:{reason:reason?.trim()||"Salon kapalı"}});
  return Response.json({success:true});
}
export async function DELETE(request:Request){const date=new URL(request.url).searchParams.get("date");if(date)await getDb().delete(closedDays).where(eq(closedDays.date,date));return Response.json({success:true});}
