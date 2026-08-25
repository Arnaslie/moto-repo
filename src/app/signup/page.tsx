import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { safeNextPath } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign up · moto-repo" };
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next ?? "/");
  return <AuthForm mode="signup" next={next} />;
}
