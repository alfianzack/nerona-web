import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";
import { AdminBankSettingsPanel } from "@/components/admin/AdminBankSettingsPanel";
import { AdminAiSettingsPanel } from "@/components/admin/AdminAiSettingsPanel";
import { AdminPlanPointsPanel } from "@/components/admin/AdminPlanPointsPanel";
import { AdminDownloadSettingsPanel } from "@/components/admin/AdminDownloadSettingsPanel";

export default function AdminSettingsPage() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <AdminBankSettingsPanel />
      <AdminPricingPanel />
      <AdminPlanPointsPanel />
      <AdminDownloadSettingsPanel />
      <AdminAiSettingsPanel />
    </div>
  );
}
