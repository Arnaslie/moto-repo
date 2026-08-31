// Comms — the intercom. Gear 5. Keep this half free of React/Next/Prisma
// imports.
//
// Voice rooms for riders who are *off* the bike; Cardo owns the in-motion case.
// A host opens a room and takes the first of four mic seats ("the floor");
// everyone else is "the pack", hearing the floor and talking in text. The seat
// limit caps who talks over whom — it is not a queue to participate.

/** Mic seats on the floor. A product choice, not a technical limit — real
 *  Cardo DMC carries 15. Four is how many people can hold one conversation. */
export const SEATS = 4;

export const TITLE_MAX = 80;

/** Topics are tags on a room, not permanent channels. */
export const TOPICS = [
  { id: "maintenance", label: "Maintenance", blurb: "Spanners, diagnosis, what that noise is" },
  { id: "rally", label: "Rally & rides", blurb: "Meets, routes, who's going" },
  { id: "gear", label: "Gear", blurb: "Helmets, jackets, boots, what's worth the money" },
  { id: "general", label: "General", blurb: "Anything on two wheels" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

const TOPIC_IDS = TOPICS.map((t) => t.id) as readonly string[];

export function isTopicId(value: unknown): value is TopicId {
  return typeof value === "string" && TOPIC_IDS.includes(value);
}

export function topicLabel(id: string): string {
  return TOPICS.find((t) => t.id === id)?.label ?? "General";
}

/** A room as the directory and the room page see it. `host` is the handle,
 *  joined on read rather than stored, since a handle can change. */
export type RoomSummary = {
  id: string;
  title: string;
  topic: string;
  host: string;
  hostDisplayName: string | null;
  openedAt: string;
  /** Live occupancy is LiveKit's to answer, not ours — null until the room is
   *  actually wired to the SFU. Rendering a fake 0 would read as "dead room". */
  listening: number | null;
  seatsTaken: number | null;
};

export type OpenRoomInput = { title: string; topic: TopicId };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseOpenRoomInput(body: unknown): Parsed<OpenRoomInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const { title, topic } = body as Record<string, unknown>;

  const parsedTitle = parseTitle(title);
  if (!parsedTitle.ok) return parsedTitle;

  if (!isTopicId(topic)) {
    return { ok: false, error: "Pick a topic for the room." };
  }

  return { ok: true, value: { title: parsedTitle.value, topic } };
}

/** Shared with the edit-while-live path: a conversation that starts on carb
 *  sync ends up on rally routes, and the title should be able to follow it. */
export function parseTitle(title: unknown): Parsed<string> {
  if (typeof title !== "string") {
    return { ok: false, error: "Give the room a title." };
  }
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (trimmed.length < 3) {
    return { ok: false, error: "Give the room a title — at least 3 characters." };
  }
  if (trimmed.length > TITLE_MAX) {
    return { ok: false, error: `Titles are ${TITLE_MAX} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function riderCount(n: number): string {
  return `${n} rider${n === 1 ? "" : "s"}`;
}
