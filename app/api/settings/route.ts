import { apiError, requireAdmin } from "../../../lib/api-auth";
import { adminSupabase, unwrap } from "../../../lib/supabase";
export async function GET(request: Request) { try { requireAdmin(request); const row = unwrap(await adminSupabase().from("gym_settings").select("*").eq("id", 1).single()); return Response.json({ entryQrToken: row.entrance_qr_token }); } catch (error) { return apiError(error); } }
export async function PUT(request: Request) { try { requireAdmin(request); const value = crypto.randomUUID(); unwrap(await adminSupabase().from("gym_settings").update({ entrance_qr_token: value, updated_at: new Date().toISOString() }).eq("id", 1)); return Response.json({ entryQrToken: value }); } catch (error) { return apiError(error); } }
