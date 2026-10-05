import { apiError, requireMember } from "../../../lib/api-auth";
import { adminSupabase, rowToMember, unwrap } from "../../../lib/supabase";
const addMonth = (value: string) => { const d = new Date(`${value}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export async function POST(request: Request) {
  try {
    const { memberId, freezeStartDate } = await request.json() as { memberId?: number; freezeStartDate?: string };
    if (!memberId) throw new Error("Üye bilgisi eksik.");
    const member = await requireMember(request, memberId);
    if (member.freeze_used) throw new Error("Bir aylık dondurma hakkı daha önce kullanılmış.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(freezeStartDate || "") || freezeStartDate! < today() || freezeStartDate! > member.end_date) throw new Error("Geçerli bir dondurma başlangıç tarihi seçin.");
    const row = unwrap(await adminSupabase().from("members").update({ freeze_used: true, freeze_start_date: freezeStartDate, frozen_until: addMonth(freezeStartDate!), end_date: addMonth(member.end_date), status: freezeStartDate === today() ? "frozen" : member.status, updated_at: new Date().toISOString() }).eq("id", memberId).select().single());
    return Response.json({ member: rowToMember(row) });
  } catch (error) { return apiError(error); }
}
