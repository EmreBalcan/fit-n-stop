import { adminSupabase, unwrap } from "./supabase";

const ownerEmail = "emrebalcan494@gmail.com";

export function requireAdmin(request: Request) {
  if (request.headers.get("oai-authenticated-user-email")?.toLowerCase() !== ownerEmail) {
    throw new Error("Yönetici yetkisi gerekli.");
  }
}

export async function requireMember(request: Request, memberId?: number) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Oturum gerekli.");
  const db = adminSupabase();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Oturum geçersiz.");
  const row = unwrap(await db.from("members").select("*").eq("auth_user_id", data.user.id).single());
  if (memberId && row.id !== memberId) throw new Error("Bu işlem için yetkiniz yok.");
  return row;
}

export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "İşlem tamamlanamadı.";
  return Response.json({ error: message }, { status: /yetki|Oturum/.test(message) ? 403 : status });
}
