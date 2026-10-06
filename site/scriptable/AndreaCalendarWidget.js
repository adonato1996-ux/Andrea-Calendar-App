// Andrea Calendar — Scriptable widget
// Replace only WIDGET_READ_KEY on the iPhone. Never commit the real key.

const SNAPSHOT_URL = "https://andrea-calendar-reminder-relay.lyfeos-app-cloud.workers.dev/api/widget/snapshot";
const CALENDAR_URL = "https://adonato1996-ux.github.io/Andrea-Calendar-App/";
const WIDGET_READ_KEY = "REPLACE_WITH_CALENDAR_WIDGET_READ_KEY";
const CACHE_FILE = "andrea-calendar-widget-v1.json";

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateSnapshot(value) {
  if (!value || value.schemaVersion !== 1 || !validDate(value.generatedAt) || !Array.isArray(value.events)) return null;
  if (value.events.length > 20) return null;
  const events = [];
  for (const item of value.events) {
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" || !validDate(item.start) || typeof item.allDay !== "boolean") return null;
    events.push({ id: item.id, title: item.title, start: item.start, allDay: item.allDay });
  }
  return { schemaVersion: 1, generatedAt: value.generatedAt, events };
}

function cachePath() {
  const manager = FileManager.local();
  return manager.joinPath(manager.documentsDirectory(), CACHE_FILE);
}

function readCache() {
  try {
    const manager = FileManager.local();
    const path = cachePath();
    if (!manager.fileExists(path)) return null;
    return validateSnapshot(JSON.parse(manager.readString(path)));
  } catch (_) {
    return null;
  }
}

function writeCache(snapshot) {
  try { FileManager.local().writeString(cachePath(), JSON.stringify(snapshot)); } catch (_) { /* cache best effort */ }
}

async function loadSnapshot() {
  if (WIDGET_READ_KEY.startsWith("REPLACE_")) return { snapshot: readCache(), cached: true, configurationMissing: true };
  try {
    const request = new Request(SNAPSHOT_URL);
    request.headers = { Authorization: `Bearer ${WIDGET_READ_KEY}` };
    request.timeoutInterval = 8;
    const snapshot = validateSnapshot(await request.loadJSON());
    if (!snapshot) throw new Error("Snapshot non valido");
    writeCache(snapshot);
    return { snapshot, cached: false, configurationMissing: false };
  } catch (_) {
    return { snapshot: readCache(), cached: true, configurationMissing: false };
  }
}

function eventTime(event) {
  if (event.allDay) return "Tutto il giorno";
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.start));
}

function eventDay(event) {
  const date = new Date(event.start);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Oggi";
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return "Domani";
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function addEmptyState(widget, message) {
  widget.addSpacer();
  const empty = widget.addText(message);
  empty.font = Font.mediumSystemFont(13);
  empty.textColor = Color.dynamic(new Color("6e6e73"), new Color("a1a1a6"));
  empty.centerAlignText();
  widget.addSpacer();
}

function buildWidget(result) {
  const widget = new ListWidget();
  widget.url = CALENDAR_URL;
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  widget.backgroundColor = Color.dynamic(new Color("f6f4ee"), new Color("171717"));
  widget.setPadding(14, 14, 12, 14);

  const title = widget.addText("Andrea Calendar");
  title.font = Font.boldSystemFont(15);
  title.textColor = Color.dynamic(new Color("1d1d1f"), Color.white());
  widget.addSpacer(8);

  if (result.configurationMissing) {
    addEmptyState(widget, "Configura la chiave widget");
    return widget;
  }
  if (!result.snapshot) {
    addEmptyState(widget, "Agenda non disponibile");
    return widget;
  }

  const today = new Date();
  const localToday = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  const upcoming = result.snapshot.events.filter((event) => event.allDay ? event.start.slice(0, 10) >= localToday : Date.parse(event.start) > Date.now());
  const limit = config.widgetFamily === "small" ? 2 : 4;
  if (upcoming.length === 0) addEmptyState(widget, "Nessun impegno in arrivo");
  for (const event of upcoming.slice(0, limit)) {
    const row = widget.addStack();
    row.layoutHorizontally();
    const when = row.addText(`${eventDay(event)} · ${eventTime(event)}`);
    when.font = Font.semiboldSystemFont(11);
    when.textColor = new Color("8a5a2b");
    row.addSpacer(7);
    const name = row.addText(event.title);
    name.font = Font.systemFont(12);
    name.lineLimit = 1;
    name.textColor = Color.dynamic(new Color("2b2b2b"), new Color("eeeeee"));
    widget.addSpacer(6);
  }

  const footer = widget.addText(result.cached ? "Cache locale" : "Aggiornato ora");
  footer.font = Font.systemFont(9);
  footer.textColor = Color.dynamic(new Color("6e6e73"), new Color("a1a1a6"));
  return widget;
}

(async () => {
  const widget = buildWidget(await loadSnapshot());
  Script.setWidget(widget);
  if (!config.runsInWidget) await widget.presentMedium();
  Script.complete();
})();
