import { describe, it, expect } from "vitest";
import { generateStaffEmail } from "./email-generator";

describe("generateStaffEmail", () => {
  it("should format email correctly with standard inputs", () => {
    const email = generateStaffEmail("Budi Santoso", "jkt01-xyz-123");
    expect(email).toBe("budisantoso.jkt01@ss.com");
  });

  it("should remove special characters from name", () => {
    const email = generateStaffEmail("Rini O'Connor!", "bdg02-123");
    expect(email).toBe("rinioconnor.bdg02@ss.com");
  });

  it("should handle single word names", () => {
    const email = generateStaffEmail("Siti", "outlet-1");
    expect(email).toBe("siti.outlet@ss.com");
  });
});
