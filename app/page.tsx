import AdminClient from "./admin-client";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { Download, Dumbbell, LogIn, ShieldCheck, Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";
const APK_URL = "/fit-n-stop-v1.7.apk";

function PublicHome({ denied = false }: { denied?: boolean }) {
  return <main className="public-home">
    <div className="public-home-backdrop" />
    <header className="public-home-header"><div className="public-brand"><b>FİT</b><span>N</span><strong>STOP</strong></div><a className="public-admin-link" href={chatGPTSignInPath("/")} target="_top"><ShieldCheck/> Yönetici Girişi</a></header>
    <section className="public-hero">
      <div className="public-copy"><span className="public-kicker">FİT N STOP MOBİL</span><h1>Antrenmanın,<br/>randevun ve salonun<br/><em>tek uygulamada.</em></h1><p>Randevunu oluştur, QR kodla giriş yap, antrenman programını takip et ve gelişimini görüntüle.</p>{denied&&<div className="public-denied">Yönetim paneli yalnızca salon yöneticisine açıktır. Üye uygulamasını kullanmaya devam edebilirsin.</div>}<div className="public-actions"><a className="public-primary" href="/mobil"><LogIn/> Üye Girişi</a><a className="public-secondary" href={APK_URL} download><Download/> Android APK İndir</a><a className="public-demo" href="/demo"><ShieldCheck/> Yönetici Paneli Demosu</a></div><small><ShieldCheck/> Üyeliğin oluşturulduktan sonra TC ve şifrenle giriş yapabilirsin.</small></div>
      <aside className="public-download-card"><div className="public-phone"><Smartphone/><span>ANDROID UYGULAMASI</span><strong>Telefonuna indir</strong></div><img src="/fit-n-stop-download-qr.png" alt="FİT N STOP Android uygulamasını indirme QR kodu"/><b>QR kodu telefonunla okut</b><p>APK dosyasını indirip uygulamayı kur.</p><div><Dumbbell/> Randevu · QR Giriş · Antrenman</div></aside>
    </section>
  </main>;
}

export default async function AdminPage() {
  const user = await getChatGPTUser();
  if (!user) return <PublicHome />;
  if (user.email.toLowerCase() !== "emrebalcan494@gmail.com") return <PublicHome denied />;
  return <AdminClient />;
}
