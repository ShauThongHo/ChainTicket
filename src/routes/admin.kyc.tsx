import { createFileRoute } from "@tanstack/react-router";
import { AdminListDirectory } from "@/components/admin-list-directory";

export const Route = createFileRoute("/admin/kyc")({ component: AdminKyc });

function AdminKyc() {
  return <AdminListDirectory initialFolder={null} />;
}
