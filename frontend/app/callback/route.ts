import { handleAuth } from "@workos-inc/authkit-nextjs";

import { registerAsTradesperson } from "@/lib/api/identity";

/**
 * AuthKit callback that idempotently registers the tradesperson after sign-in.
 * Registration errors do not block authentication; missing roles can be retried later.
 */
export const GET = handleAuth({
  returnPathname: "/dashboard",
  onSuccess: async ({ accessToken }) => {
    await registerAsTradesperson(accessToken);
  },
});