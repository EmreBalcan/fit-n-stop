import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { members } from "../../../db/schema";
import { hashPassword, hashTc } from "../../../lib/member-security";
export async function POST(request: Request) {
  const { tcNo, password } = await request.json() as { tcNo?: string; password?: string };
  if (!/^\d{11}$/.test(tcNo ?? "") || !password) return Response.json({ error: "TC kimlik numarası veya şifre hatalı." }, { status: 401 });
  const [member] = await getDb().select().from(members).where(eq(members.tcHash, await hashTc(tcNo!))).limit(1);
  if (!member?.passwordSalt || !member.passwordHash) return Response.json({ error: "TC kimlik numarası veya şifre hatalı." }, { status: 401 });
  const attempt = await hashPassword(password!, member.passwordSalt);
  if (attempt.hash !== member.passwordHash) return Response.json({ error: "TC kimlik numarası veya şifre hatalı." }, { status: 401 });
  if (member.status !== "active") return Response.json({ error: "Üyeliğiniz aktif değil. Salon yönetimiyle görüşün." }, { status: 403 });
  return Response.json({ member: { id: member.id, fullName: member.fullName, startDate: member.startDate, endDate: member.endDate, mustChangePassword: member.mustChangePassword } });
}
