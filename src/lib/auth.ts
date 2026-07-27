// Client-agnostic auth input validation (no server/Prisma imports).

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 8;

export type SignupInput = {
  email: string;
  handle: string;
  password: string;
  displayName: string | null;
};

export type LoginInput = {
  email: string;
  password: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isEmail(value: string): boolean {
  // Deliberately loose — real validation is "can we send to it", which is out
  // of scope. This just catches obvious typos.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseSignup(body: unknown): Result<SignupInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const { email, handle, password, displayName } = body as Record<string, unknown>;

  const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!isEmail(emailStr)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const handleStr = typeof handle === "string" ? handle.trim().toLowerCase() : "";
  if (!HANDLE_RE.test(handleStr)) {
    return {
      ok: false,
      error: "Handle must be 3–20 characters: lowercase letters, numbers, or underscores.",
    };
  }

  const passwordStr = typeof password === "string" ? password : "";
  if (passwordStr.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const nameStr =
    typeof displayName === "string" && displayName.trim()
      ? displayName.trim().slice(0, 50)
      : null;

  return { ok: true, value: { email: emailStr, handle: handleStr, password: passwordStr, displayName: nameStr } };
}

export function parseLogin(body: unknown): Result<LoginInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const { email, password } = body as Record<string, unknown>;

  const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
  const passwordStr = typeof password === "string" ? password : "";
  if (!emailStr || !passwordStr) {
    return { ok: false, error: "Email and password are required." };
  }
  return { ok: true, value: { email: emailStr, password: passwordStr } };
}
