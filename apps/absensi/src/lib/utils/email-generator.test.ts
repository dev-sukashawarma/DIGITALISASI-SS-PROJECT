import { describe, it, expect } from "vitest";
import { generateStaffEmail } from "./email-generator";

describe("generateStaffEmail", () => {
  it("should format email correctly with standard inputs", () => {
    const email = generateStaffEmail("budi_santoso");
    expect(email).toBe("budi_santoso@ss.com");
  });

  it("should lowercase and strip special characters from username", () => {
    const email = generateStaffEmail("Rini O'Connor!");
    expect(email).toBe("rinioconnor@ss.com");
  });

  it("should handle single word names", () => {
    const email = generateStaffEmail("Siti");
    expect(email).toBe("siti@ss.com");
  });
});
