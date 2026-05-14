import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { searchTelegram, type FilterType } from "./search.js";
import { filterActiveResults } from "./verify.js";
import { logger } from "../lib/logger.js";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");

export const bot = new Telegraf(BOT_TOKEN);

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_EMOJI: Record<string, string> = {
  channel:   "📢",
  group:     "👥",
  bot:       "🤖",
  telegraph: "📰",
  message:   "💬",
  unknown:   "📌",
};

const FILTER_LABEL: Record<FilterType, string> = {
  all:       "🔍 الكل",
  channels:  "📢 القنوات",
  groups:    "👥 المجموعات",
  bots:      "🤖 البوتات",
  telegraph: "📰 Telegraph",
  messages:  "💬 الرسائل",
  videos:    "🎬 فيديو",
  software:  "💿 برامج",
  images:    "🖼 صور",
  links:     "🔗 روابط",
};

const DEV_BUTTON = Markup.button.url("👨‍💻 المطور", "https://t.me/a_l_s_g_r_bot");
const MAX_QUERY_LEN = 44;

// ─── Static messages ──────────────────────────────────────────────────────────
const WELCOME = `\
🔍 *مرحباً في بوت بحث تيليجرام*

يمكنك البحث عن القنوات والمجموعات والبوتات والفيديو والبرامج والصور والروابط\\.

*كيفية الاستخدام:*
• أرسل أي نص للبحث مباشرة
• /search \\[نص\\] — بحث بأمر مباشر
• /help — مساعدة

_مدعوم من lyzem\\.com_`;

const HELP = `\
*📖 المساعدة:*

*البحث:*
أرسل أي نص وسأبحث فوراً في تيليجرام\\.

*الفلاتر المتاحة:*
🔍 الكل — 📢 القنوات — 👥 المجموعات — 🤖 البوتات
📰 Telegraph — 💬 الرسائل
🎬 فيديو — 💿 برامج — 🖼 صور — 🔗 روابط

*أمثلة:*
• \`برمجة\` ثم اضغط 🎬 فيديو
• \`أخبار\` ثم اضغط 🔗 روابط
• /search تقنية

_البيانات من lyzem\\.com — يتم تصفية الحسابات المحذوفة تلقائياً_`;

// ─── Commands ─────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  try {
    await ctx.replyWithMarkdownV2(WELCOME, {
      ...Markup.keyboard([["🔍 بحث", "❓ مساعدة"]]).resize(),
      ...Markup.inlineKeyboard([[DEV_BUTTON]]),
    });
  } catch (err) { logger.error({ err }, "/start error"); }
});

bot.help(async (ctx) => {
  try {
    await ctx.replyWithMarkdownV2(HELP, Markup.inlineKeyboard([[DEV_BUTTON]]));
  } catch (err) { logger.error({ err }, "/help error"); }
});

bot.command("search", async (ctx) => {
  const query = ctx.message.text.replace(/^\/search\s*/i, "").trim();
  if (!query) {
    await ctx.reply("⚠️ أرسل كلمة البحث بعد الأمر.\nمثال: /search برمجة", Markup.inlineKeyboard([[DEV_BUTTON]]));
    return;
  }
  await runSearch(ctx, query, 1, "all", false);
});

bot.hears("❓ مساعدة", async (ctx) => {
  try { await ctx.replyWithMarkdownV2(HELP, Markup.inlineKeyboard([[DEV_BUTTON]])); }
  catch (err) { logger.error({ err }, "help hears error"); }
});

bot.hears("🔍 بحث", async (ctx) => {
  try { await ctx.reply("🔍 أرسل كلمة البحث الآن:", Markup.inlineKeyboard([[DEV_BUTTON]])); }
  catch (err) { logger.error({ err }, "search hears error"); }
});

// ─── Free text ────────────────────────────────────────────────────────────────
bot.on(message("text"), async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/") || text === "❓ مساعدة" || text === "🔍 بحث") return;
  await runSearch(ctx, text, 1, "all", false);
});

// ─── Callback: s|{page}|{filter}|{query} ─────────────────────────────────────
bot.action(/^s\|(\d+)\|(\w+)\|(.+)$/, async (ctx) => {
  const [, pageStr, filter, query] = ctx.match as RegExpMatchArray;
  try { await ctx.answerCbQuery("جاري التحميل..."); } catch { /* ignore */ }
  await runSearch(ctx, query, parseInt(pageStr, 10), filter as FilterType, true);
});

// ─── Core search ──────────────────────────────────────────────────────────────
async function runSearch(ctx: any, query: string, page: number, filter: FilterType, editMessage: boolean) {
  let loadingMsgId: number | undefined;

  if (!editMessage) {
    try {
      const loading = await ctx.reply(
        `⏳ جاري البحث عن: *${esc(query.slice(0, 50))}*\n_يتم التحقق من النتائج وتصفية المحذوف…_`,
        { parse_mode: "MarkdownV2" },
      );
      loadingMsgId = loading.message_id;
    } catch (err) { logger.error({ err }, "Failed to send loading message"); }
  }

  try {
    const res = await searchTelegram(query, page, filter, 25);
    const activeResults = await filterActiveResults(res.results);
    const displayRes = { ...res, results: activeResults };
    const text = buildResultMessage(displayRes);
    const keyboard = buildKeyboard(query, page, filter, res.total, res.perPage);
    const opts = {
      parse_mode: "MarkdownV2" as const,
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard.reply_markup,
    };

    if (editMessage) {
      try { await ctx.editMessageText(text, opts); }
      catch (editErr: any) {
        if (!editErr?.description?.includes("message is not modified")) await ctx.reply(text, opts);
      }
    } else {
      if (loadingMsgId) {
        try { await ctx.telegram.editMessageText(ctx.chat.id, loadingMsgId, undefined, text, opts); }
        catch { await ctx.reply(text, opts); }
      } else {
        await ctx.reply(text, opts);
      }
    }
  } catch (err) {
    logger.error({ err, query, page, filter }, "Search error");
    const errText = "⚠️ حدث خطأ أثناء البحث\\. حاول مرة أخرى\\.";
    const errOpts = { parse_mode: "MarkdownV2" as const, ...Markup.inlineKeyboard([[DEV_BUTTON]]) };
    try {
      if (editMessage) await ctx.editMessageText(errText, errOpts);
      else if (loadingMsgId) await ctx.telegram.editMessageText(ctx.chat.id, loadingMsgId, undefined, errText, errOpts);
      else await ctx.reply(errText, errOpts);
    } catch (e) { logger.error({ e }, "Failed to send error message"); }
  }
}

// ─── Message builder ──────────────────────────────────────────────────────────
function buildResultMessage(res: Awaited<ReturnType<typeof searchTelegram>> & { results: any[] }): string {
  if (res.results.length === 0) {
    return `❌ *لا توجد نتائج نشطة*\n\nلم يُعثر على نتائج للبحث عن: *${esc(res.query)}*\n_جرّب فلتراً مختلفاً أو كلمات أخرى\\._`;
  }

  const totalPages = res.total > 0 ? Math.ceil(res.total / res.perPage) : 1;
  const timeStr = res.timeTaken ? ` \\| ${esc(res.timeTaken)}` : "";
  const filterLabel = FILTER_LABEL[res.filter] ?? "";
  const filterStr = res.filter !== "all" ? `\n🏷 النوع: ${esc(filterLabel)}` : "";

  const header =
    `🔍 *نتائج البحث عن: ${esc(res.query.slice(0, 40))}*\n` +
    `📊 ${res.total.toLocaleString("ar")} نتيجة \\| صفحة ${res.page} من ${totalPages}${timeStr}${filterStr}\n` +
    `✅ _تم تصفية الحسابات المحذوفة_\n\n`;

  const lines = res.results.map((r, i) => {
    const num = (res.page - 1) * res.perPage + i + 1;
    const emoji = TYPE_EMOJI[r.type] ?? "📌";
    const title = esc(r.title.trim().slice(0, 55));
    const desc = r.description.trim().slice(0, 90);
    const descLine = desc ? `\n   _${esc(desc)}_` : "";
    const linkLine = r.link ? `\n   🔗 [فتح](${r.link})` : "";
    return `${num}\\. ${emoji} *${title}*${descLine}${linkLine}`;
  });

  return header + lines.join("\n\n");
}

// ─── Keyboard builder ─────────────────────────────────────────────────────────
function buildKeyboard(query: string, page: number, filter: FilterType, total: number, perPage: number) {
  const totalPages = total > 0 ? Math.ceil(total / perPage) : 1;

  // أزرار التنقل
  const navRow: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 1)          navRow.push(Markup.button.callback("⬅️ السابق", cbData(page - 1, filter, query)));
  if (page < totalPages) navRow.push(Markup.button.callback("➡️ التالي", cbData(page + 1, filter, query)));

  // الصف الأول: الكل + القنوات + المجموعات + البوتات
  const row1: FilterType[] = ["all", "channels", "groups", "bots"];
  // الصف الثاني: Telegraph + الرسائل + فيديو
  const row2: FilterType[] = ["telegraph", "messages", "videos"];
  // الصف الثالث: برامج + صور + روابط
  const row3: FilterType[] = ["software", "images", "links"];

  const makeRow = (filters: FilterType[]) =>
    filters.map((f) => {
      const label = f === filter ? `✅ ${FILTER_LABEL[f]}` : FILTER_LABEL[f];
      return Markup.button.callback(label, cbData(1, f, query));
    });

  const rows: (ReturnType<typeof Markup.button.callback> | ReturnType<typeof Markup.button.url>)[][] = [];
  if (navRow.length > 0) rows.push(navRow);
  rows.push(makeRow(row1));
  rows.push(makeRow(row2));
  rows.push(makeRow(row3));
  rows.push([DEV_BUTTON]);

  return Markup.inlineKeyboard(rows);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cbData(page: number, filter: FilterType, query: string): string {
  return `s|${page}|${filter}|${query.slice(0, MAX_QUERY_LEN)}`;
}

function esc(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

// ─── Bot launch ───────────────────────────────────────────────────────────────
export async function startBot() {
  const info = await bot.telegram.getMe();
  logger.info({ username: info.username }, "Telegram bot starting");
  bot.launch();
  logger.info("Telegram bot launched successfully");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

