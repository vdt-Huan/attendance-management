import { Icons, type IconName } from "../components/icons";

interface PlaceholderPageProps {
  title: string;
  icon: IconName;
  description: string;
}

// Trang giữ chỗ cho các module chưa triển khai nghiệp vụ.
// Thể hiện rõ "đang phát triển", không giả vờ hoàn chỉnh.
export function PlaceholderPage({ title, icon, description }: PlaceholderPageProps) {
  const Icon = Icons[icon];
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-blue-200 bg-white px-6 py-16 text-center shadow-sm">
      <span className="rounded-2xl bg-blue-50 p-4 text-blue-600">
        <Icon className="h-8 w-8" />
      </span>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        Giao diện đang phát triển
      </span>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
    </section>
  );
}
