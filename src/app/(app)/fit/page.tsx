import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { FitView } from "@/components/fit/FitView";
import { INSEAM_SOURCES, type Inseam, type InseamSource } from "@/lib/inseam";

export const metadata = {
  title: "Fit · moto-repo",
  description:
    "Whether you can get a foot down, worked out from your inseam rather than a spec sheet.",
};

export const dynamic = "force-dynamic";

// Third gear. See ADR 0006.
//
// `getCurrentUser` deliberately doesn't select the inseam: the layout hands that
// object to the header on every page, and body data has no business riding
// along. This is the one query that reads it, keyed on the session id and never
// on a handle from the URL.
export default async function FitPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/fit")}`);

  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { inseamMm: true, inseamSource: true, inseamSpreadMm: true },
  });

  // The column is a plain string; narrow it before it reaches the client.
  const source = INSEAM_SOURCES.includes(row.inseamSource as InseamSource)
    ? (row.inseamSource as InseamSource)
    : null;

  const inseam: Inseam | null =
    row.inseamMm != null && source != null
      ? {
          inseamMm: row.inseamMm,
          inseamSource: source,
          inseamSpreadMm: row.inseamSpreadMm,
        }
      : null;

  return <FitView initialInseam={inseam} />;
}
