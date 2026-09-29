import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { members } from "../../../db/schema";
import { hashPassword, hashTc } from "../../../lib/member-security";
export async function POST(request:Request){
  const {tcNo,currentPassword,newPassword}=await request.json() as {tcNo?:string;currentPassword?:string;newPassword?:string};
  if(!/^\d{11}$/.test(tcNo??"")||!currentPassword||!newPassword||newPassword.length<6)return Response.json({error:"Bilgileri kontrol edin. Yeni şifre en az 6 karakter olmalıdır."},{status:400});
  const [member]=await getDb().select().from(members).where(eq(members.tcHash,await hashTc(tcNo!))).limit(1);
  if(!member?.passwordSalt||!member.passwordHash)return Response.json({error:"Üye bulunamadı."},{status:404});
  const attempt=await hashPassword(currentPassword,member.passwordSalt);if(attempt.hash!==member.passwordHash)return Response.json({error:"Geçici şifre hatalı."},{status:401});
  const next=await hashPassword(newPassword);await getDb().update(members).set({passwordHash:next.hash,passwordSalt:next.salt,mustChangePassword:false,updatedAt:new Date().toISOString()}).where(eq(members.id,member.id));
  return Response.json({success:true});
}
