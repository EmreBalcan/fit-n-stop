import { apiError, requireAdmin } from "../../../lib/api-auth";
import { adminSupabase, unwrap } from "../../../lib/supabase";

type GymInfo = { about: string; address: string; trainerName: string; phone: string };

function fromRow(row: Record<string, unknown>): GymInfo {
  return {
    about: String(row.about || ""),
    address: String(row.address || ""),
    trainerName: String(row.trainer_name || ""),
    phone: String(row.phone || ""),
  };
}

export async function GET() {
  try {
    const row = unwrap(await adminSupabase().from("gym_settings").select("about,address,trainer_name,phone").eq("id", 1).single());
    return Response.json({ gym: fromRow(row) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, 500); }
}

export async function PUT(request: Request) {
  try {
    requireAdmin(request);
    const body = await request.json() as Partial<GymInfo>;
    const about = String(body.about || "").trim();
    const address = String(body.address || "").trim();
    const trainerName = String(body.trainerName || "").trim();
    const phone = String(body.phone || "").trim();
    if (about.length > 500 || address.length > 300 || trainerName.length > 100 || phone.length > 40) throw new Error("Salon bilgileri çok uzun.");
    const row = unwrap(await adminSupabase().from("gym_settings").update({ about, address, trainer_name: trainerName, phone, updated_at: new Date().toISOString() }).eq("id", 1).select("about,address,trainer_name,phone").single());
    return Response.json({ gym: fromRow(row) });
  } catch (error) { return apiError(error); }
}
