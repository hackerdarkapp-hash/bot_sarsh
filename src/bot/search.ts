import { parse } from "node-html-parser";

export type ResultType = "channel" | "group" | "bot" | "telegraph" | "message" | "unknown";
export type FilterType = "all" | "channels" | "groups" | "bots" | "telegraph" | "messages";

export interface SearchResult {
  title: string;
  username: string;
  description: string;
  type: ResultType;
  link: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  timeTaken: string;
  query: string;
  page: number;
  perPage: number;
  filter: FilterType;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "ar,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  Referer: "https://lyzem.com/",
};

function parseType(raw: string): ResultType {
  switch (raw.trim().toLowerCase()) {
    case "channel": return "channel";
    case "group": return "group";
    case "bot": return "bot";
    case "telegraph": return "telegraph";
    case "message": return "message";
    default: return "unknown";
  }
}

export async function searchTelegram(
  query: string,
  page = 1,
  filter: FilterType = "all",
  perPage = 25,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    f: filter,
    l: "",
    p: String(page),
    "per-page": String(perPage),
  });

  const url = `https://lyzem.com/search?${params.toString()}`;

  const res = await fetch(url, { headers: HEADERS });

  if (!res.ok) {
    throw new Error(`فشل الاتصال بخادم البحث: ${res.status}`);
  }

  const html = await res.text();
  const root = parse(html);

  // Parse total results and time — ".info-line p.is-size-6" → "170 results – 35ms"
  const infoText = root.querySelector(".info-line p.is-size-6")?.text?.trim() ?? "";
  const totalMatch = infoText.match(/([\d,]+)\s+results?/i);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, "")) : 0;
  const timeMatch = infoText.match(/([\d]+ms)/i);
  const timeTaken = timeMatch ? timeMatch[1] : "";

  // Parse each result — "ul.search-results li.search-result"
  const items = root.querySelectorAll("ul.search-results li.search-result");

  const results: SearchResult[] = items.map((item) => {
    // Type from title attribute on ".search-result-type-wrapper"
    const typeRaw = item.querySelector(".search-result-type-wrapper")?.getAttribute("title") ?? "";
    const type = parseType(typeRaw);

    // Title and link from ".search-result-title a"
    const titleEl = item.querySelector(".search-result-title a");
    const title = titleEl?.text?.trim() ?? "";
    const link = titleEl?.getAttribute("href") ?? "";

    // Username from t.me link
    const username = link.includes("t.me/")
      ? link.split("t.me/").pop()?.split("?")[0] ?? ""
      : link.split("/").pop() ?? "";

    // Description from ".search-result-descr a"
    const description = item.querySelector(".search-result-descr a")?.text?.trim() ?? "";

    return { title, username, description, type, link };
  }).filter((r) => r.title.length > 0);

  return { results, total, timeTaken, query, page, perPage, filter };
}
