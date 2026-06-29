export type GlobalCalibrationSubmission = {
  id: string; // unique submission id
  matched_outlet_id: string;
  matched_outlet_name: string;
  distance_meters: number;
  lat: number;
  lng: number;
  accuracy: number;
  address: string;
  submitted_at: string;
};

// In-memory store (temporary for this session)
const submissions: Record<string, GlobalCalibrationSubmission> = {};

export function saveGlobalSubmission(sub: GlobalCalibrationSubmission) {
  submissions[sub.id] = sub;
}

export function getAllGlobalSubmissions(): GlobalCalibrationSubmission[] {
  return Object.values(submissions).sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
}

export function getGlobalSubmission(id: string): GlobalCalibrationSubmission | undefined {
  return submissions[id];
}

export function deleteGlobalSubmission(id: string) {
  delete submissions[id];
}
