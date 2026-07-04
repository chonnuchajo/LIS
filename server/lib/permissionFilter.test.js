const { isStorablePermission } = require("./permissionFilter");

describe("isStorablePermission", () => {
  const valid = new Set(["qc", "/report"]);

  it("keeps known group ids", () => {
    expect(isStorablePermission("qc", valid)).toBe(true);
  });
  it("keeps known group paths", () => {
    expect(isStorablePermission("/report", valid)).toBe(true);
  });
  it("keeps any route-shaped string", () => {
    expect(isStorablePermission("/stock", valid)).toBe(true);
  });
  it("keeps deny tokens", () => {
    expect(isStorablePermission("deny:/stock/history", valid)).toBe(true);
  });
  it("drops unrecognized junk", () => {
    expect(isStorablePermission("random", valid)).toBe(false);
  });
  it("drops non-strings", () => {
    expect(isStorablePermission(5, valid)).toBe(false);
  });
});
