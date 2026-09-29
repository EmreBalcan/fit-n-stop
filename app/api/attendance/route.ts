import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { attendances, reservations } from "../../../db/schema";

const nowInIstanbul = () => {
  const date = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const time = new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date());
  return {date,time};
};

export async function POST(request:Request){
  const {memberId}=await request.json() as {memberId?:number};
  if(!memberId)return Response.json({error:"Üye bilgisi eksik."},{status:400});
  const now=nowInIstanbul();
  const [reservation]=await getDb().select().from(reservations).where(and(eq(reservations.memberId,memberId),eq(reservations.date,now.date))).limit(1);
  if(!reservation)return Response.json({error:"Bugün için randevu bulunamadı."},{status:400});
  const [existing]=await getDb().select().from(attendances).where(and(eq(attendances.memberId,memberId),eq(attendances.date,now.date))).limit(1);
  if(existing)return Response.json({attendance:existing,alreadyEntered:true});
  const [attendance]=await getDb().insert(attendances).values({memberId,date:now.date,checkedInAt:now.time,reservationTimeSlot:reservation.timeSlot}).returning();
  return Response.json({attendance,alreadyEntered:false});
}
