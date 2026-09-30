import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { members } from "../../../db/schema";
const addMonth=(value:string)=>{const d=new Date(`${value}T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,10)};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export async function POST(request:Request){
  const {memberId}=await request.json() as {memberId?:number};if(!memberId)return Response.json({error:"Üye bilgisi eksik."},{status:400});
  const [member]=await getDb().select().from(members).where(eq(members.id,memberId)).limit(1);
  if(!member)return Response.json({error:"Üye bulunamadı."},{status:404});
  if(member.freezeUsed)return Response.json({error:"Bir aylık dondurma hakkı daha önce kullanılmış."},{status:400});
  const [updated]=await getDb().update(members).set({freezeUsed:true,frozenUntil:addMonth(today()),endDate:addMonth(member.endDate),status:"frozen",updatedAt:new Date().toISOString()}).where(eq(members.id,memberId)).returning();
  return Response.json({member:{...updated,passwordHash:undefined,passwordSalt:undefined,tcHash:undefined}});
}
