import Link from "next/link";
import { notFound } from "next/navigation";
import { FAMILIES, TRICKS, difficulty, trickBySlug } from "@moto/core/tricks";
import { TrickSequence } from "@/components/tricks/TrickSequence";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const trick = trickBySlug((await params).slug);
  return trick ? { title: `${trick.name} · Tricks · moto-repo`, description: trick.summary } : {};
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--anat-note)]">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

const chip = "rounded-full border border-[var(--drive-hair)] px-3 py-1 text-sm";

export default async function TrickPage({ params }: Props) {
  const trick = trickBySlug((await params).slug);
  if (!trick) notFound();

  const unlocks = TRICKS.filter((t) => t.requires.includes(trick.slug));

  return (
    <div className="px-4 py-8">
      <Link href="/tricks" className="text-sm text-[var(--anat-note)] hover:underline">
        ← Tricks
      </Link>

      <header className="mt-3">
        <p className="font-mono text-xs uppercase tabular-nums text-[var(--anat-note)]">
          {FAMILIES[trick.family]} · LVL {difficulty(trick.slug)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{trick.name}</h1>
        <p className="mt-1 max-w-prose text-[15px]">{trick.summary}</p>
      </header>

      <div className="mt-6 rounded-lg border border-[var(--anat-line)] px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--anat-line)]">
          Bail-out
        </h2>
        <p className="mt-1 text-[15px]">{trick.bailOut}</p>
      </div>

      <Section title="Sequence">
        <TrickSequence sequence={trick.sequence} />
      </Section>

      <Section title="Learn first">
        {trick.requires.length === 0 ? (
          <p className="text-sm text-[var(--anat-note)]">Nothing. This is where you start.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {trick.requires.map((slug) => (
              <li key={slug}>
                <Link href={`/tricks/${slug}`} className={`${chip} block hover:border-[var(--anat-line)]`}>
                  {trickBySlug(slug)?.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Strength">
        <dl className="divide-y divide-[var(--drive-hair)] border-y border-[var(--drive-hair)]">
          {trick.strength.map((s) => (
            <div key={s.area} className="flex gap-4 py-2 text-sm">
              <dt className="w-20 shrink-0 font-semibold">{s.area}</dt>
              <dd>{s.test}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Trick Kit">
        <div className="grid gap-6 sm:grid-cols-2">
          {([["You wear", trick.kit.protective], ["The bike gets", trick.kit.bike]] as const).map(
            ([label, items]) => (
              <div key={label}>
                <h3 className="text-sm font-semibold">{label}</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </Section>

      <Section title="Progression">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {trick.progression.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>

      {unlocks.length > 0 && (
        <Section title="Leads to">
          <ul className="flex flex-wrap gap-2">
            {unlocks.map((t) => (
              <li key={t.slug}>
                <Link href={`/tricks/${t.slug}`} className={`${chip} block hover:border-[var(--anat-line)]`}>
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
