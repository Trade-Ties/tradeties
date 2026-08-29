import { redirect } from "next/navigation";

import { WIZARD_PATH } from "@/lib/routes";

export default async function CreateProfilePage() {
  redirect(WIZARD_PATH);
}
