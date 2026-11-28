import { createFileRoute } from "@tanstack/react-router";
import { AdminListDirectory } from "@/components/admin-list-directory";

export const Route = createFileRoute("/admin/organizers")({ component: OrganizersPage });

function OrganizersPage() {
  return <AdminListDirectory initialFolder="organizers" />;
}
