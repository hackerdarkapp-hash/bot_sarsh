import { parse } from "node-html-parser";

export type ResultType = "channel" | "group" | "bot" | "telegraph" | "message" | "unknown";

export type FilterType =
  | "all"
  | "channels"
  | "groups"
  | "bots"
  | "telegraph"
  | "messages"
  | "videos"
  | "software"
  | "images"
  | "links";

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
  displayQuery: string;
  page: number;
  perPage: number;
  filter: FilterType;
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "ar,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  Referer: "https://lyzem.com/",
};

// خريطة الفلاتر: lyzem filter + كلمات مفتاحية تُضاف للبحث
const FILTER_MAP: Record<FilterType, { lyzemFilter: string; prefix: string }> = {
  all:       { lyzemFilter: "all",      prefix: "" },
  channels:  { lyzemFilter: "channels", prefix: "" },
  groups:    { lyzemFilter: "groups",   prefix: "" },
  bots:      { lyzemFilter: "bots",     prefix: "" },
  telegraph: { lyzemFilter: "telegraph",prefix: "" },
  messages:  { lyzemFilter: "messages", prefix: "" },
  videos:    { lyzemFilter: "all",      prefix: "فيديو" },
  software:  { lyzemFilter: "all",      prefix: "برنامج تطبيق" },
  images:    { lyzemFilter: "all",      prefix: "صور" },
  links:     { lyzemFilter: "messages", prefix: "روابط" },
};

function parseType(raw: string): ResultType {
  switch (raw.trim().toLowerCase()) {
    case "channel":   return "channel";
    case "group":     return "group";
    case "bot":       return "bot";
    case "telegraph": return "telegraph";
    case "message":   return "message";
    default:          return "unknown";
  }
}

export async function searchTelegram(
  query: string,
  page = 1,
  filter: FilterType = "all",
  perPage = 25,
): Promise<SearchResponse> {
  const { lyzemFilter, prefix } = FILTER_MAP[filter] ?? FILTER_MAP["all"];
  const actualQuery = prefix ? `${prefix} ${query}` : query;

  const params = new URLSearchParams({
    q: actualQuery,
    f: lyzemFilter,
    l: "",
    p: String(page),
    "per-page": String(perPage),
  });

  const url = `https://lyzem.com/search?${params.toString()}`;
  const res = await fetch(url, { headers: HEADERS });

  if (!res.ok) throw new Error(`فشل الاتصال بخادم البحث: ${res.status}`);

  const html = await res.text();
  const root = parse(html);

  const infoText = root.querySelector(".info-line p.is-size-6")?.text?.trim() ?? "";
  const totalMatch = infoText.match(/([\d,]+)\s+results?/i);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, "")) : 0;
  const timeMatch = infoText.match(/([\d]+ms)/i);
  const timeTaken = timeMatch ? timeMatch[1] : "";

  const items = root.querySelectorAll("ul.search-results li.search-result");

  const results: SearchResult[] = items.map((item) => {
    const typeRaw = item.querySelector(".search-result-type-wrapper")?.getAttribute("title") ?? "";
    const type = parseType(typeRaw);
    const titleEl = item.querySelector(".search-result-title a");
    const title = titleEl?.text?.trim() ?? "";
    const link = titleEl?.getAttribute("href") ?? "";
    const username = link.includes("t.me/")
      ? link.split("t.me/").pop()?.split("?")[0] ?? ""
      : link.split("/").pop() ?? "";
    const description = item.querySelector(".search-result-descr a")?.text?.trim() ?? "";
    return { title, username, description, type, link };
  }).filter((r) => r.title.length > 0);

  return { results, total, timeTaken, query, displayQuery: query, page, perPage, filter };
}

