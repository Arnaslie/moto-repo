# ADR 0010 — A domain, and the environments behind it

- **Status:** Partly implemented — production is live on the domain; the preview
  environment is specified here and not yet provisioned
- **Date:** 2026-09-05
- **Supersedes / superseded by:** —
- **Touches:** no application code. Vercel project settings (Domains,
  Deployment Protection, Environment Variables), IONOS DNS, `DEPLOYMENT.md`

---

## Context

The app has been reachable at `moto-repo.vercel.app` since it went up. Sharing
that link with anyone outside the team meant turning **Deployment Protection**
off wholesale, which is the wrong lever: it unlocks preview and branch deploys
along with production, so every unreviewed branch becomes public in order to
show one person the feed.

The lever is wrong because the property it was reaching for already exists.
Vercel's Standard Protection is defined as *protect everything except production
custom domains* — so a project with a real domain gets a public front door and
private previews with no setting toggled at all. This project didn't have one.
There was nothing for the exclusion to apply to, so the only way to show anyone
the site was to unlock all of it.

Second thing, discovered while wiring the domain up. The database credentials
are scoped to **Production only**, which is correct and deliberate: `vercel-build`
in `apps/web/package.json` runs

```
prisma migrate deploy && tsx prisma/seed-catalog.ts && next build
```

and Vercel applies unscoped variables to every environment, so an unscoped
`DATABASE_URL` means **a preview build runs migrations against the production
database**. Scoping closes that. But no Preview values were added in their
place, and an environment with no database is not a safe environment — it is a
broken one. Previews now fail twice over:

1. `prisma migrate deploy` exits **P1012** before it opens a connection. Prisma
   resolves every `env()` in the datasource block first, so a missing
   `DATABASE_URL_UNPOOLED` fails the command outright. `DEPLOYMENT.md` already
   documents this trap; what it doesn't say is that Production-only scoping is
   what springs it.
2. Past that, `apps/web/src/lib/session.ts:18-22` throws at module load when
   `SESSION_SECRET` is absent. That fires during `next build` while collecting
   page data, so the build fails there too.

Neither shows up in production. Both show up on the next pull request.

---

## Decision

**`throttleride.global`, apex canonical, registered at IONOS with DNS kept
there.** Protection goes back on and stays on. Preview gets a database and a
session secret of its own.

### The redirect belongs at Vercel, not at the registrar

The first attempt pointed the apex at IONOS's domain forwarding. It failed in
both directions at once:

```
http://throttleride.global   → 404 from 74.208.236.245, no redirect issued
https://throttleride.global  → TLS handshake failure
```

The 404 is a misconfiguration and might have been fixable. The TLS failure is
structural: **IONOS has no certificate for a domain it isn't hosting**, and
never will. Every browser tries HTTPS first, so the bare domain would have shown
a full-page security warning to everyone who typed it — worse than a 404,
because it reads as compromised rather than missing.

Vercel issues a real certificate per host and redirects at the edge with the
path preserved. So: registrar holds the DNS, Vercel holds the certificates and
every redirect.

### Apex canonical, everything else 308s to it

| Host | Behaviour |
| --- | --- |
| `throttleride.global` | serves the app |
| `www.throttleride.global` | 308 → apex |
| `moto-repo.vercel.app` | 308 → apex |

Apex over `www` because it is what people type and what fits on a sticker, and
because `.global` reads badly with a prefix in front of it.

**One origin is a correctness requirement here, not a preference.** `iron-session`
scopes its cookie to the host that set it, so an app served directly on two
hosts signs a rider out when they cross between them. Redirecting collapses the
question instead of leaving it to be discovered.

308 rather than 307 on all of them. The trade is real — permanent redirects are
cached by the browser more or less forever and cannot be recalled — but which
host is canonical is a decision that does not get revisited, and the permanent
form is what consolidates search ranking rather than splitting it three ways.

`moto-repo.vercel.app` is **redirected rather than removed**. Vercel allocates
`.vercel.app` subdomains first-come-first-served and does not reserve them, so
removing it releases the name for anyone to claim. Redirecting keeps the name,
kills the second public origin, and means links already shared land on the real
site.

### Protection: on, and the alias is not what it protects

Standard Protection, verified in place:

```
throttleride.global               200   public
moto-repo-git-main-…              302 → vercel.com/sso-api
moto-repo-git-feature-anatomy-…   302 → vercel.com/sso-api
moto-repo.vercel.app              200   public
```

That last row is the one worth writing down. **`moto-repo.vercel.app` is not
covered by Standard Protection**, because it is registered on the project as a
Production domain and the exclusion is for production domains generally, not for
custom ones specifically. Anyone reasoning "protection is on, therefore the
alias is private" is wrong. Its 308 is what closes it, not the protection
setting — which is the second, independent reason that redirect exists.

**The health probe moves to the branch URL.** The `.vercel.app` alias used to be
the way to tell "the app is broken" from "DNS is broken"; once it 308s to the
apex it inherits the apex's failures, and at 308 the browser won't even ask
again. `moto-repo-git-main-morning-misfits.vercel.app` replaces it: not a
project domain, so no redirect touches it, and already behind SSO so only the
team can reach it.

### Preview gets its own database

Three Preview-scoped variables:

| Var | Value |
| --- | --- |
| `DATABASE_URL` | preview database, **pooled** |
| `DATABASE_URL_UNPOOLED` | same database, direct endpoint |
| `SESSION_SECRET` | a fresh 32+ char string, deliberately **not** production's |

A separate secret rather than a shared one, so a session minted against preview
data cannot be presented to production. Sharing it would make the two
environments one trust boundary for no benefit.

**An empty database, not a copy of production.** A Neon branch would carry real
rider rows into an environment more people can reach, and nothing here needs
them: `vercel-build` runs `prisma migrate deploy` and then `seed-catalog`, so a
blank Postgres self-assembles into a working app — schema from the migrations,
and `GearItem` populated so signup doesn't fail on the
`UserGear_gearItemId_fkey` constraint the way a bare-migrated database would.
Demo posts are the only thing missing, and signing up a fresh rider in preview
is more useful testing than inheriting `ada` and `bex` anyway.

One long-lived preview database shared by every preview deploy. Per-deployment
branching is available and is more machinery than a project with one contributor
needs.

**`BLOB_READ_WRITE_TOKEN` is knowingly left unset for Preview.** `uploads.ts:55`
falls back to disk when it's absent, which on serverless means uploads are
written to an ephemeral filesystem and are gone by the next invocation. The
alternative is sharing the production store and scattering test images through
real data. Broken uploads in preview are the cheaper failure, and this record is
where that is written down so the next person doesn't debug it as a bug.

`NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES` stays unset for Preview too; the effect is
that the guest wave button is hidden there, which is the production default.

---

## Order of work

1. Create the preview database; take the pooled and direct connection strings.
2. Add the three Preview-scoped variables in Vercel.
3. Open a throwaway PR and confirm the preview deploy builds and serves.
4. Update `DEPLOYMENT.md` — it predates the domain, the protection model, the
   workspace split of [0009](./0009-monorepo-for-mobile.md), and this preview
   requirement, and still reads as though the remaining work is configuration.

Steps 1–3 are the whole of it. Nothing in `apps/web` or `packages/core` changes.

---

## Verification

Domain and protection, all confirmed against the live deployment on 2026-09-05:

- Certificates issued per host — Let's Encrypt, SAN `throttleride.global` and
  SAN `www.throttleride.global`, valid to 2026-12-04. Checked by reading the
  served certificate, not by trusting a green padlock.
- `throttleride.global` and `/comms` both 200.
- `www` and `moto-repo.vercel.app` 308 to the apex, path preserved.
- Both branch URLs 302 to `vercel.com/sso-api`.
- The IONOS forwarding is gone and no `74.208.236.245` record survives in the
  zone.

The control that matters, and the one that cost the most time: **a browser
showing "cannot provide a secure connection" is not evidence of a broken
certificate.** The old apex record was cached at its original 1-hour TTL, so
resolvers kept handing out the IONOS parking IP — which has no certificate for
this domain — long after the record changed. The same URL, at the same moment,
resolved by hand:

```
curl https://throttleride.global/                    → 74.208.236.245 → TLS error
curl --resolve throttleride.global:443:216.198.79.1  → 200, valid cert
```

Query the authoritative nameserver directly (`dig @ns1064.ui-dns.com`) before
changing anything in response to a browser error. Vercel's two-year
`strict-transport-security` header makes a cached failure look permanent.

Preview, once provisioned:

- A PR builds green — past `migrate deploy`, past `seed-catalog`, past
  `next build`.
- Signup works on the preview URL, which is what proves the catalog seed ran
  against an empty database.
- The preview database is untouched by production traffic and vice versa,
  checked by writing a row in one and looking for it in the other.
- A rider signed in on preview is **not** signed in on production. That is the
  separate `SESSION_SECRET` doing its job, and it is the assertion a shared
  secret would silently fail.

---

## Consequences

**Accepted:**

- The site has a name that can be said out loud, and sharing it no longer means
  unlocking every branch deploy.
- Protection is on and stays on. Previews and branch deploys are behind SSO;
  exactly one origin is public.
- One canonical host, so the session cookie has one home.
- Production's database can no longer be migrated by a preview build, and
  previews stop being collateral damage of the scoping that achieved it.

**Costs and risks:**

- **The 308s are effectively irreversible.** Changing canonical host later
  leaves every prior visitor redirected by their own browser cache.
- **A second database to keep in mind.** Its schema drifts from production
  between deploys, and it is one more connection string that can rot.
- **Uploads don't work in preview**, by choice. See above.
- **The apex A record hardcodes a Vercel IP.** Subdomains ride a CNAME and
  survive Vercel renumbering; DNS forbids a CNAME at the zone root, so the apex
  cannot. If Vercel rotates that address the apex breaks until the record is
  changed by hand.
- **DNS lives at IONOS, certificates at Vercel, redirects at Vercel.** Three
  places to look when something is wrong, and the failure that started this had
  its cause in the first and its symptom in the second.
