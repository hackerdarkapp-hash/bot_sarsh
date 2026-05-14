import { parse } from "node-html-parser";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

export type AccountStatus = "active" | "deleted" | "unknown";

async function checkOne(username: string): Promise<AccountStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`https://t.me/${username}`, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return "deleted";

    const html = await res.text();
    const root = parse(html);

    // Active pages always have .tgme_page_extra (subscriber/member count area)
    const extra = root.querySelector(".tgme_page_extra");
    if (!extra) return "deleted";

    return "active";
  } catch {
    clearTimeout(timer);
    // Network error or abort — treat as unknown (don't hide it)
    return "unknown";
  }
}

export async function filterActiveResults<T extends { username: string; link: string }>(
  results: T[],
  concurrency = 8,
): Promise<T[]> {
  const active: T[] = [];

  for (let i = 0; i < results.length; i += concurrency) {
    const batch = results.slice(i, i + concurrency);
    const statuses = await Promise.all(
      batch.map((r) => {
        // Telegraph articles have no Telegram username — keep them
        if (!r.username || r.link.includes("telegra.ph")) return Promise.resolve("active" as AccountStatus);
        return checkOne(r.username);
      }),
    );

    for (let j = 0; j < batch.length; j++) {
      if (statuses[j] !== "deleted") {
        active.push(batch[j]!);
      }
    }
  }

  return active;
}
