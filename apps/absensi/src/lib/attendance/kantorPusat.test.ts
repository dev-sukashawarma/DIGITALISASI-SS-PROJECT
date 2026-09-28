import { describe, expect, it } from "vitest";
import { adalahKantorPusat, ID_KANTOR_PUSAT, staffDiKantorPusat } from "./kantorPusat";

describe("adalahKantorPusat", () => {
  it("mengenali Kantor Pusat lewat id, slug, atau nama office", () => {
    expect(adalahKantorPusat({ id: ID_KANTOR_PUSAT })).toBe(true);
    expect(adalahKantorPusat({ slug: "kantor-pusat" })).toBe(true);
    expect(adalahKantorPusat({ type: "office", name: "KANTOR PUSAT" })).toBe(true);
  });

  it("Gudang Pusat bertipe office tetap bukan Kantor Pusat", () => {
    expect(adalahKantorPusat({ id: "d23e11b3", type: "office", name: "GUDANG PUSAT (HQ)", slug: "suka-shawarma-hq" })).toBe(false);
  });

  it("outlet biasa atau data kosong bukan Kantor Pusat", () => {
    expect(adalahKantorPusat({ type: "outlet", name: "SUKA SHAWARMA BNR" })).toBe(false);
    expect(adalahKantorPusat(null)).toBe(false);
  });
});

describe("staffDiKantorPusat", () => {
  it("staf dengan outlet utama Kantor Pusat", () => {
    expect(staffDiKantorPusat({ outlet_id: ID_KANTOR_PUSAT, outlets: null })).toBe(true);
    expect(staffDiKantorPusat({ outlet_id: "x", outlets: { name: "KANTOR PUSAT" } })).toBe(true);
  });

  it("staf gudang, outlet, atau tanpa outlet bukan Kantor Pusat", () => {
    expect(staffDiKantorPusat({ outlet_id: "x", outlets: { name: "GUDANG PUSAT (HQ)" } })).toBe(false);
    expect(staffDiKantorPusat({ outlet_id: "x", outlets: { name: "SUKA SHAWARMA BNR" } })).toBe(false);
    expect(staffDiKantorPusat({ outlet_id: null, outlets: null })).toBe(false);
    expect(staffDiKantorPusat(null)).toBe(false);
  });
});
