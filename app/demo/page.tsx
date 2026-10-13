import AdminClient from "../admin-client";

export const metadata = {
  title: "FİT N STOP | Yönetici Paneli Demosu",
  description: "FİT N STOP yönetici panelinin herkese açık, salt okunur ürün demosu.",
};

export default function DemoPage() {
  return <AdminClient demo />;
}
