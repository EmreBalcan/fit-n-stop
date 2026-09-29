import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { members } from "../../../../db/schema";
import { hashPassword, temporaryPassword } from "../../../../lib/member-security";
export async function POST(request: Request) {
  const { id } = await request.json() as { id?: number };
  if (!id) return Response.json({ error: "Üye kimliği eksik." }, { status: 400 });
  const password = temporaryPassword(); const secured = await hashPassword(password);
  const [member] = await getDb().update(members).set({ passwordHash: secured.hash, passwordSalt: secured.salt, mustChangePassword: true, updatedAt: new Date().toISOString() }).where(eq(members.id, id)).returning();
  if (!member) return Response.json({ error: "Üye bulunamadı." }, { status: 404 });
  return Response.json({ password });
}
