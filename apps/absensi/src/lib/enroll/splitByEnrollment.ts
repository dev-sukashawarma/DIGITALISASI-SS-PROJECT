export type EnrollStaff = {
  id: string;
  name: string;
  role: string;
  enrolled_at: string | null;
};

/** Pisah staff menjadi yang belum enroll (enrolled_at null) dan yang sudah. */
export function splitByEnrollment<T extends { enrolled_at: string | null }>(
  staff: T[],
): { unenrolled: T[]; enrolled: T[] } {
  const unenrolled: T[] = [];
  const enrolled: T[] = [];
  for (const s of staff) {
    if (s.enrolled_at) enrolled.push(s);
    else unenrolled.push(s);
  }
  return { unenrolled, enrolled };
}
