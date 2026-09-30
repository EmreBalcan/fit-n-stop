import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function publicSupabase() {
  if (!url || !publicKey) throw new Error("Supabase bağlantısı yapılandırılmamış.");
  return createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function adminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu bağlantısı yapılandırılmamış.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const authEmail = (tc: string) => `${tc}@fitnstop.app`;

export function rowToMember(row: Record<string, any>) {
  return {
    id: row.id, fullName: row.full_name, phone: row.phone, email: row.email,
    startDate: row.start_date, endDate: row.end_date, status: row.status === "expired" ? "cancelled" : row.status,
    notes: row.notes || "", createdAt: row.created_at, updatedAt: row.updated_at,
    tcLast4: row.tc_no?.slice(-4), mustChangePassword: row.must_change_password,
    freezeUsed: row.freeze_used, frozenUntil: row.frozen_until,
    hasPassword: !!row.auth_user_id,
  };
}

export function rowToReservation(row: Record<string, any>) {
  return { id: row.id, memberId: row.member_id, date: row.reservation_date, timeSlot: row.time_slot, createdAt: row.created_at };
}

export function rowToAttendance(row: Record<string, any>) {
  const checkedInAt = row.entry_time ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(row.entry_time)) : "";
  return { id: row.id, memberId: row.member_id, date: row.entry_date, checkedInAt, reservationTimeSlot: row.reserved_time_slot };
}

export function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

export async function broadcastGymChange(table: string, date?: string) {
  const client = adminSupabase();
  const channel = client.channel("gym-updates");
  try { await channel.httpSend("changed", { table, date }); }
  catch (error) { console.error("Supabase Realtime bildirimi gönderilemedi", error); }
  finally { try { await client.removeChannel(channel); } catch { /* Data writes must not fail on a notification cleanup. */ } }
}
