import { portalSession } from "@/lib/portal/session";

export default async function DashboardPage() {
  const { user, marketplaceUser } = await portalSession();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome{user.firstName ? `, ${user.firstName}` : ""}
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your business account is active. This is where your calendar and incoming requests
        will live.
      </p>
    </div>
  );
}