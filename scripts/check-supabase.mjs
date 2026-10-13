// Kiểm tra kết nối Supabase AN TOÀN (Ngày 1 — Prompt 3).
// - Health check kèm header apikey (project mới yêu cầu key cả ở /health),
//   sau đó đọc phiên cục bộ: không đọc/ghi dữ liệu nghiệp vụ.
// - KHÔNG in khóa/bí mật: chỉ hiển thị hostname và trạng thái.
// - Nguồn cấu hình: biến môi trường process.env, fallback file .env (local).
// - Dùng process.exitCode thay cho process.exit() để tránh crash libuv
//   (Assertion failed) trên Windows.
// Exit code: 0 = ok, 1 = thiếu cấu hình, 2 = lỗi kết nối.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const URL_VAR = "VITE_SUPABASE_URL";
const KEY_VAR = "VITE_SUPABASE_PUBLISHABLE_KEY";

function parseDotEnv(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) env[key] = value;
  }
  return env;
}

function maskHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(URL không hợp lệ)";
  }
}

const fileEnv = parseDotEnv(resolve(process.cwd(), ".env"));
const url = process.env[URL_VAR] ?? fileEnv[URL_VAR] ?? "";
const key = process.env[KEY_VAR] ?? fileEnv[KEY_VAR] ?? "";

const missing = [];
if (!url) missing.push(URL_VAR);
if (!key) missing.push(KEY_VAR);
if (missing.length > 0) {
  console.error(`[missing-env] Thiếu cấu hình Supabase: ${missing.join(", ")}.`);
  console.error(
    "Sao chép .env.example thành .env và điền giá trị của đúng project mới.",
  );
  process.exitCode = 1;
} else {
  await main();
}

async function main() {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.error(`[invalid-url] ${URL_VAR} không phải URL hợp lệ.`);
    process.exitCode = 1;
    return;
  }
  if (parsed.protocol !== "https:") {
    console.error(`[invalid-url] ${URL_VAR} phải dùng https (nhận: ${parsed.protocol}).`);
    process.exitCode = 1;
    return;
  }
  if (!parsed.host.endsWith(".supabase.co")) {
    console.warn(
      `[cảnh báo] Host ${parsed.host} không có dạng *.supabase.co — hãy chắc đây là đúng project mới.`,
    );
  }

  console.log(`Project host: ${maskHost(url)} (key: đã cấu hình, không hiển thị)`);

  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch (err) {
    console.error(`[lỗi] Không nạp được @supabase/supabase-js: ${err.message}`);
    process.exitCode = 2;
    return;
  }

  try {
    // Bước 1: health check KÈM header apikey (project mới yêu cầu key ngay
    // cả ở /health; thiếu key sẽ 401). 2xx = host đúng + key hợp lệ.
    // getSession() đơn thuần đọc local nên không thể thay bước này.
    const base = url.replace(/\/$/, "");
    let health;
    try {
      health = await fetch(`${base}/auth/v1/health`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      console.error(`[network] Không tới được ${parsed.host}: ${err.cause?.message ?? err.message}`);
      console.error("Kiểm tra URL project, mạng và DNS.");
      process.exitCode = 2;
      return;
    }
    if (health.status === 401) {
      console.error("[invalid-key] Key không hợp lệ (401). Kiểm tra lại publishable key của đúng project.");
      process.exitCode = 2;
      return;
    }
    if (!health.ok) {
      console.error(`[lỗi] Máy chủ phản hồi bất thường (HTTP ${health.status}). Kiểm tra lại URL.`);
      process.exitCode = 2;
      return;
    }
    console.log("[ok] Auth phản hồi — host và key hợp lệ.");

    // Bước 2: phiên đăng nhập cục bộ (không chứng minh network).
    const supabase = createClient(url, key);
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error(`[lỗi] Supabase trả lỗi: ${error.message}`);
      process.exitCode = 2;
      return;
    }
    if (data.session) {
      console.log("[ok] Đang có phiên đăng nhập.");
    } else {
      console.log("[ghi chú] Chưa đăng nhập — trạng thái bình thường.");
    }
  } catch (err) {
    const msg = `${err?.name ?? ""}: ${err?.message ?? String(err)}`.toLowerCase();
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("fetch") || msg.includes("enotfound") || msg.includes("econn")) {
      console.error("[network] Không tới được Supabase. Kiểm tra URL, mạng và DNS.");
      process.exitCode = 2;
      return;
    }
    console.error(`[lỗi] Không xác định được trạng thái kết nối: ${err?.message ?? err}`);
    process.exitCode = 2;
  }
}
