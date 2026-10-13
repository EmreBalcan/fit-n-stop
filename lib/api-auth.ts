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
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (row.status === "expired" || row.status === "cancelled" || row.end_date < today) throw new Error("Üyelik süreniz sona erdi. Salon yönetimiyle görüşün.");
  if (memberId && row.id !== memberId) throw new Error("Bu işlem için yetkiniz yok.");
  return row;
}

export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "İşlem tamamlanamadı.";
  return Response.json({ error: message }, { status: /yetki|Oturum/.test(message) ? 403 : status });
}
