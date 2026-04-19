import { redirect } from "next/navigation";

/** التوجيه إلى لوحة موحّدة: /users?tab=roles */
export default function RolesPageRedirect() {
  redirect("/users?tab=roles");
}
