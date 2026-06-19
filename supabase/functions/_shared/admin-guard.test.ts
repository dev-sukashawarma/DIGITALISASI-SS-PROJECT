/// <reference lib="deno.ns" />
import { assertEquals, assertThrows } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { assertAdmin, validateCreateInput, validateStatus } from "./admin-guard.ts";

Deno.test("assertAdmin throws for non-admin role", () => {
  assertThrows(() => assertAdmin({ role: "spv" }), Error, "Unauthorized");
  assertThrows(() => assertAdmin({ role: "kepala_outlet" }), Error, "Unauthorized");
  assertThrows(() => assertAdmin(null), Error, "Unauthorized");
});

Deno.test("assertAdmin passes for admin role", () => {
  assertAdmin({ role: "admin" }); // does not throw
});

Deno.test("validateCreateInput requires core fields", () => {
  assertThrows(() => validateCreateInput({ name: "", username: "u", password: "p", role: "crew", outlet_id: "o" }), Error, "Missing");
  assertThrows(() => validateCreateInput({ name: "n", username: "u", password: "p", role: "crew" }), Error, "Missing");
});

Deno.test("validateCreateInput requires outlet_ids for kepala_outlet", () => {
  assertThrows(
    () => validateCreateInput({ name: "n", username: "u", password: "p", role: "kepala_outlet", outlet_id: "o" }),
    Error,
    "outlet_ids",
  );
  // valid kepala_outlet with outlet_ids does not throw
  validateCreateInput({ name: "n", username: "u", password: "p", role: "kepala_outlet", outlet_id: "o", outlet_ids: ["a"] });
});

Deno.test("validateStatus only allows known statuses", () => {
  assertEquals(validateStatus("active"), "active");
  assertEquals(validateStatus("inactive"), "inactive");
  assertEquals(validateStatus("on_leave"), "on_leave");
  assertThrows(() => validateStatus("banned"), Error, "Invalid status");
});
