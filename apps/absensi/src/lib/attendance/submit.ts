import type { AttendancePayload, SubmitResult } from "./types";

export type SubmitOptions = {
  functionUrl: string;
  anonKey?: string;
  fetchImpl?: typeof fetch;
};

export async function submitAttendance(
  payload: AttendancePayload & { outlet_id: string },
  opts: SubmitOptions,
): Promise<SubmitResult> {
  const f = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.anonKey) {
    headers["Authorization"] = `Bearer ${opts.anonKey}`;
  }

  const res = await f(opts.functionUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return (await res.json()) as SubmitResult;
}
