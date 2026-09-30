import AdminClient from "./admin-client";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await getChatGPTUser();
  if (!user) return <main style={{ padding: 32, fontFamily: "sans-serif" }}><h1>Yönetici girişi</h1><a href={chatGPTSignInPath("/")} target="_top">ChatGPT ile giriş yap</a></main>;
  if (user.email.toLowerCase() !== "emrebalcan494@gmail.com") return <main style={{ padding: 32, fontFamily: "sans-serif" }}><h1>Erişim izni yok</h1><p>Bu alan yalnızca salon yöneticisine açıktır.</p></main>;
  return <AdminClient />;
}
