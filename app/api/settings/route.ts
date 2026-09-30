import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { gymSettings } from "../../../db/schema";
const QR_KEY="entry_qr_token";
export async function GET(){const [row]=await getDb().select().from(gymSettings).where(eq(gymSettings.key,QR_KEY)).limit(1);return Response.json({entryQrToken:row?.value||"FITNSTOP-GIRIS-2026"});}
export async function PUT(){const value=crypto.randomUUID();await getDb().insert(gymSettings).values({key:QR_KEY,value,updatedAt:new Date().toISOString()}).onConflictDoUpdate({target:gymSettings.key,set:{value,updatedAt:new Date().toISOString()}});return Response.json({entryQrToken:value});}
