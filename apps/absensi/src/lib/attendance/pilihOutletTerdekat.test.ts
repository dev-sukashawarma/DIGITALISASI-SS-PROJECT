import { describe, it, expect } from "vitest";
import { pilihOutletTerdekat } from "./pilihOutletTerdekat";

// Koordinat nyata: "outlet tes" sengaja disalin dari BNR (dipakai developer menguji).
const TITIK_BNR = { lat: -6.6290369, lng: 106.7979449 };
const outletTes = { id: "tes", lat: TITIK_BNR.lat, lng: TITIK_BNR.lng, type: "test" };
const bnr = { id: "bnr", lat: TITIK_BNR.lat, lng: TITIK_BNR.lng, type: "outlet" };
const beji = { id: "beji", lat: -6.37, lng: 106.82, type: "outlet" };

describe("pilihOutletTerdekat", () => {
  it("jarak seri: outlet operasional menang atas outlet tes, walau outlet tes lebih dulu di daftar", () => {
    expect(pilihOutletTerdekat([beji, outletTes, bnr], TITIK_BNR)).toBe("bnr");
  });

  it("jarak seri: outlet operasional menang atas marketplace", () => {
    const gudang = { id: "gudang", lat: 1, lng: 1, type: "gudang" };
    const tiktok = { id: "tiktok", lat: 1, lng: 1, type: "marketplace" };
    expect(pilihOutletTerdekat([tiktok, gudang], { lat: 1, lng: 1 })).toBe("gudang");
  });

  it("outlet tes tetap terpilih bila memang satu-satunya yang terdekat", () => {
    const jauh = { id: "jauh", lat: -6.2, lng: 106.8, type: "outlet" };
    expect(pilihOutletTerdekat([jauh, outletTes], TITIK_BNR)).toBe("tes");
  });

  it("jarak tidak seri: yang terdekat menang apa pun tipenya", () => {
    const tesDekat = { ...outletTes, lat: TITIK_BNR.lat + 0.0005 };
    const bnrJauh = { ...bnr, lat: TITIK_BNR.lat + 0.01 };
    expect(pilihOutletTerdekat([bnrJauh, tesDekat], TITIK_BNR)).toBe("tes");
  });

  it("outlet tanpa koordinat dilewati; daftar tanpa koordinat → undefined", () => {
    const tanpaKoordinat = { id: "hq", lat: null, lng: null, type: "office" };
    expect(pilihOutletTerdekat([tanpaKoordinat, bnr], TITIK_BNR)).toBe("bnr");
    expect(pilihOutletTerdekat([tanpaKoordinat], TITIK_BNR)).toBeUndefined();
  });
});
