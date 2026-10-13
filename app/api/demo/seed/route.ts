import { apiError, requireAdmin } from "../../../../lib/api-auth";
import { adminSupabase, authEmail, unwrap } from "../../../../lib/supabase";

const samples = [
  ["11111111111", "Ayşe Yılmaz", "0500 000 00 01"],
  ["22222222222", "Yusuf Demir", "0500 000 00 02"],
  ["33333333333", "Zeynep Kaya", "0500 000 00 03"],
  ["44444444444", "Can Arslan", "0500 000 00 04"],
  ["55555555555", "Elif Şahin", "0500 000 00 05"],
  ["66666666666", "Burak Çelik", "0500 000 00 06"],
  ["77777777777", "Derya Aydın", "0500 000 00 07"],
  ["88888888888", "Mert Koç", "0500 000 00 08"],
  ["99999999999", "Selin Aksoy", "0500 000 00 09"],
] as const;

export async function POST(request:Request) {
  try {
    requireAdmin(request);
    const db = adminSupabase(), results:string[] = [];
    for (const [tc, fullName, phone] of samples) {
      const existing = await db.from("members").select("*").eq("tc_no", tc).maybeSingle();
      if (existing.error) throw existing.error;
      let authUserId = existing.data?.auth_user_id as string | undefined;
      if (authUserId) {
        const { error } = await db.auth.admin.updateUserById(authUserId, { password:"şifre1234", email:authEmail(tc), email_confirm:true, user_metadata:{notes:"[DEMO] GitHub örnek hesabı"} });
        if (error) throw error;
      } else {
        const created = await db.auth.admin.createUser({ email:authEmail(tc), password:"şifre1234", email_confirm:true, user_metadata:{notes:"[DEMO] GitHub örnek hesabı"} });
        if (created.error || !created.data.user) throw created.error || new Error("Demo hesabı oluşturulamadı.");
        authUserId = created.data.user.id;
      }
      const values = { full_name:fullName, phone, email:null, start_date:"2026-10-01", end_date:"2027-10-31", status:"active", auth_user_id:authUserId, tc_no:tc, must_change_password:false, freeze_used:false, updated_at:new Date().toISOString() };
      if (existing.data) unwrap(await db.from("members").update(values).eq("id", existing.data.id).select().single());
      else unwrap(await db.from("members").insert({...values, created_at:new Date().toISOString()}).select().single());
      results.push(tc);
    }
    return Response.json({success:true, accounts:results});
  } catch(error) { return apiError(error, 500); }
}
