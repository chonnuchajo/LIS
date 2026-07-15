import { describe, expect, it } from "vitest";
import { getAccessibleNavItemsForRoles } from "./accessNav";

describe("getAccessibleNavItemsForRoles", () => {
  it("derives homepage nav from all held roles in the access matrix and de-dupes repeated paths", () => {
    const items = getAccessibleNavItemsForRoles(["lab", "qc"], {
      groups: [{ id: "work", paths: ["/petition", "/lab-testing"] }],
      permissions: {
        lab: ["work"],
        qc: ["/petition", "/qc-testing"],
      },
    });

    expect(items.map((item) => item.path)).toEqual([
      "/petition",
      "/qc-testing",
      "/lab-testing",
    ]);
  });

  it("does not include the current home page in the header nav", () => {
    const items = getAccessibleNavItemsForRoles(["viewer"], {
      groups: [],
      permissions: { viewer: ["/home", "/petition"] },
    });

    expect(items.map((item) => item.path)).toEqual(["/petition"]);
  });

  it("returns an empty nav while the access matrix is not loaded", () => {
    expect(getAccessibleNavItemsForRoles(["lab"], undefined)).toEqual([]);
  });
});
