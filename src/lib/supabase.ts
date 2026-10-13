import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Module kết nối Supabase cho Attendance Management (Ngày 1 — Prompt 3).
//
// NGUYÊN TẮC AN TOÀN:
// - Chỉ đọc URL và publishable key từ biến môi trường Vite.
// - KHÔNG dùng service_role / secret key trong frontend.
// - KHÔNG ghi khóa thật vào mã nguồn, KHÔNG in bí mật ra console.
// - Khi thiếu cấu hình, mọi hàm ném lỗi/hàm check trả về lỗi rõ ràng
//   thay vì crash mập mờ — UI hiện tại không phụ thuộc module này.

export const SUPABASE_URL_VAR = "VITE_SUPABASE_URL";
export const SUPABASE_KEY_VAR = "VITE_SUPABASE_PUBLISHABLE_KEY";

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/** Liệt kê các biến môi trường còn thiếu (không bao giờ trả về giá trị). */
export function getSupabaseMissingVars(): string[] {
  const missing: string[] = [];
  if (!import.meta.env[SUPABASE_URL_VAR]) missing.push(SUPABASE_URL_VAR);
  if (!import.meta.env[SUPABASE_KEY_VAR]) missing.push(SUPABASE_KEY_VAR);
  return missing;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseMissingVars().length === 0;
}

/** Lấy cấu hình; ném lỗi mô tả rõ biến nào còn thiếu. */
export function getSupabaseConfig(): SupabaseConfig {
  const missing = getSupabaseMissingVars();
  if (missing.length > 0) {
    throw new Error(
      `Thiếu cấu hình Supabase: ${missing.join(", ")}. ` +
        `Sao chép .env.example thành .env và điền giá trị của đúng project Attendance Management.`,
    );
  }
  return {
    url: import.meta.env[SUPABASE_URL_VAR] as string,
    publishableKey: import.meta.env[SUPABASE_KEY_VAR] as string,
  };
}

let cachedClient: SupabaseClient | null = null;

/** Singleton client; ném lỗi rõ ràng khi chưa cấu hình. */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const { url, publishableKey } = getSupabaseConfig();
  cachedClient = createClient(url, publishableKey);
  return cachedClient;
}

export type ConnectionKind =
  | "ok"
  | "missing-env"
  | "invalid-url"
  | "network"
  | "invalid-key"
  | "unknown";

export interface ConnectionStatus {
  ok: boolean;
  kind: ConnectionKind;
  /** Thông điệp tiếng Việt, không chứa bí mật. */
  message: string;
}

/**
 * Kiểm tra kết nối an toàn theo 2 bước, không đọc/ghi dữ liệu nghiệp vụ:
 * 1. Gọi `GET /auth/v1/health` KÈM header apikey (project mới yêu cầu key
 *    ngay cả ở endpoint này) — 2xx chứng minh network + đúng host + key
 *    hợp lệ; 401 nghĩa là key sai/không thuộc project.
 * 2. Đọc phiên đăng nhập cục bộ qua `auth.getSession()` (không tốn network).
 */
export async function checkSupabaseConnection(): Promise<ConnectionStatus> {
  const missing = getSupabaseMissingVars();
  if (missing.length > 0) {
    return {
      ok: false,
      kind: "missing-env",
      message: `Chưa cấu hình Supabase (thiếu: ${missing.join(", ")}).`,
    };
  }

  let client: SupabaseClient;
  let baseUrl: string;
  let publishableKey: string;
  try {
    client = getSupabaseClient();
    ({ url: baseUrl, publishableKey } = getSupabaseConfig());
    baseUrl = baseUrl.replace(/\/$/, "");
  } catch (err) {
    return {
      ok: false,
      kind: "missing-env",
      message: err instanceof Error ? err.message : "Thiếu cấu hình Supabase.",
    };
  }

  try {
    // Bước 1: health check kèm key — bắt buộc có network thật.
    let health: Response;
    try {
      health = await fetch(`${baseUrl}/auth/v1/health`, {
        headers: { apikey: publishableKey },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return {
        ok: false,
        kind: "network",
        message:
          "Không tới được Supabase (lỗi mạng/DNS). Kiểm tra URL, mạng và việc chạy trên http(s)/localhost.",
      };
    }
    if (health.status === 401) {
      return {
        ok: false,
        kind: "invalid-key",
        message: "Key không hợp lệ (401). Kiểm tra lại publishable key của đúng project.",
      };
    }
    if (!health.ok) {
      return {
        ok: false,
        kind: "unknown",
        message: `Máy chủ Supabase phản hồi bất thường (HTTP ${health.status}). Kiểm tra lại URL project.`,
      };
    }

    // Bước 2: trạng thái phiên cục bộ (không chứng minh network).
    const { data, error } = await client.auth.getSession();
    if (error) {
      const msg = `${error.name}: ${error.message}`.toLowerCase();
      if (msg.includes("invalid api key") || msg.includes("apikey") || error.status === 401) {
        return {
          ok: false,
          kind: "invalid-key",
          message: "Key không hợp lệ (401). Kiểm tra lại publishable key của đúng project.",
        };
      }
      return { ok: false, kind: "unknown", message: `Supabase trả lỗi: ${error.message}` };
    }
    return {
      ok: true,
      kind: "ok",
      message: data.session
        ? "Kết nối thành công (host và key hợp lệ) và đang có phiên đăng nhập."
        : "Kết nối thành công (host và key hợp lệ, chưa đăng nhập — trạng thái bình thường).",
    };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}`.toLowerCase() : "";
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("fetch")) {
      return {
        ok: false,
        kind: "network",
        message:
          "Không tới được Supabase (lỗi mạng/CORS). Kiểm tra URL, mạng và việc chạy trên http(s)/localhost.",
      };
    }
    if (msg.includes("invalid url")) {
      return {
        ok: false,
        kind: "invalid-url",
        message: "URL không hợp lệ. URL phải có dạng https://<project-ref>.supabase.co.",
      };
    }
    return {
      ok: false,
      kind: "unknown",
      message: `Không xác định được trạng thái kết nối: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
