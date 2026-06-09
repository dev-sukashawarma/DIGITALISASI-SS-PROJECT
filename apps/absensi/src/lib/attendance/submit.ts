import type { AttendancePayload, SubmitResult } from "./types";

export type SubmitOptions = {
  functionUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
};

export async function submitAttendance(
  payload: AttendancePayload,
  opts: SubmitOptions,
): Promise<SubmitResult> {
  const f = opts.fetchImpl ?? fetch;
  const res = await f(opts.functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as SubmitResult;
}
