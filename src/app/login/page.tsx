import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { safeNextPath } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Log in · moto-repo" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  // Validated here, on the server, so the form below is only ever handed a
  // path we're willing to send someone to.
  const next = safeNextPath((await searchParams).next);

  // Already signed in — honour where they were headed, not the front door.
  if (await getCurrentUser()) redirect(next ?? "/");

  return <AuthForm mode="login" next={next} />;
}
