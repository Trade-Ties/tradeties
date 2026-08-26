import { portalSession } from "@/lib/portal/session";

export default async function DashboardPage() {
  const { user } = await portalSession();

  return (
    <div className="w-full max-w-5xl px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome{user.firstName ? `, ${user.firstName}` : ""}
      </h1>
      <p>
        This is your dashboard. This is wehere the calendar, inbox and other details are displayed. 
      </p>
    </div>
  );
}
