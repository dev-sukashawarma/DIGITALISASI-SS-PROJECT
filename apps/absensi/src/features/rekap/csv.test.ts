import { describe, it, expect } from "vitest";
import { attendanceToCsv, type CsvRow } from "./csv";

const rows: CsvRow[] = [
  { name: "Budi", type: "in", jam: "09:01", status: "tepat" },
  { name: 'Sari, "kasir"', type: "in", jam: "09:22", status: "telat" },
];

describe("attendanceToCsv", () => {
  it("menulis header + baris", () => {
    const csv = attendanceToCsv(rows);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Nama,Tipe,Jam,Status");
    expect(lines[1]).toBe("Budi,in,09:01,tepat");
  });
  it("escape koma & tanda kutip", () => {
    const csv = attendanceToCsv(rows);
    expect(csv.split("\n")[2]).toBe('"Sari, ""kasir""",in,09:22,telat');
  });
});
