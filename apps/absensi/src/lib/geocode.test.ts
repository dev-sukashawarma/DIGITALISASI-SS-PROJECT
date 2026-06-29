import { describe, expect, test } from "vitest";
import { buildNominatimSearchUrl, parseNominatimResults } from "./geocode";

describe("buildNominatimSearchUrl", () => {
  test("points at Nominatim search endpoint", () => {
    const url = buildNominatimSearchUrl("Suka Shawarma Cibinong");
    expect(url.startsWith("https://nominatim.openstreetmap.org/search?")).toBe(true);
  });

  test("includes the query, JSON format, Indonesia scope, and a result limit", () => {
    const url = buildNominatimSearchUrl("Jl. Pajajaran Bogor");
    const params = new URL(url).searchParams;
    expect(params.get("q")).toBe("Jl. Pajajaran Bogor");
    expect(params.get("format")).toBe("json");
    expect(params.get("countrycodes")).toBe("id");
    expect(params.get("limit")).toBe("5");
  });
});

describe("parseNominatimResults", () => {
  test("maps raw Nominatim rows to {lat,lng,label}", () => {
    const raw = [
      { lat: "-6.4600", lon: "106.8950", display_name: "Cibinong, Bogor, Jawa Barat" },
    ];
    expect(parseNominatimResults(raw)).toEqual([
      { lat: -6.46, lng: 106.895, label: "Cibinong, Bogor, Jawa Barat" },
    ]);
  });

  test("drops rows with non-numeric lat/lon", () => {
    const raw = [{ lat: "abc", lon: "106.8950", display_name: "Tempat Aneh" }];
    expect(parseNominatimResults(raw)).toEqual([]);
  });

  test("drops rows with missing display_name", () => {
    const raw = [{ lat: "-6.46", lon: "106.895", display_name: "" }];
    expect(parseNominatimResults(raw)).toEqual([]);
  });

  test("returns empty array for non-array input", () => {
    expect(parseNominatimResults(null)).toEqual([]);
    expect(parseNominatimResults(undefined)).toEqual([]);
    expect(parseNominatimResults({})).toEqual([]);
  });

  test("returns multiple normalized results in order", () => {
    const raw = [
      { lat: "-6.46", lon: "106.895", display_name: "A" },
      { lat: "-6.55", lon: "106.802", display_name: "B" },
    ];
    expect(parseNominatimResults(raw)).toEqual([
      { lat: -6.46, lng: 106.895, label: "A" },
      { lat: -6.55, lng: 106.802, label: "B" },
    ]);
  });
});
