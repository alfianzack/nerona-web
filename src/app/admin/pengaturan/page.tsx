import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";
import { AdminBankSettingsPanel } from "@/components/admin/AdminBankSettingsPanel";
import { AdminAiSettingsPanel } from "@/components/admin/AdminAiSettingsPanel";

export default function AdminSettingsPage() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <AdminBankSettingsPanel />
      <AdminPricingPanel />
      <AdminAiSettingsPanel />
    </div>
  );
}
