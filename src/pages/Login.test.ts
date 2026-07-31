import { describe, expect, it } from "vitest";
import { isDifferentRequester, productionRequestRedirect } from "./Login";

describe("productionRequestRedirect", () => {
  it("sends existing petitions to the petition list", () => {
    const params = new URLSearchParams(
      "request_no=P260715001&petitions_no=P260715001&requesterEmail=chonnucha.p%40icpladda.com",
    );

    expect(productionRequestRedirect(params)).toBe(
      "/petition?request_no=P260715001&petitions_no=P260715001&requesterEmail=chonnucha.p%40icpladda.com",
    );
  });

  it("keeps new production requests on the canonical new petition page", () => {
    const params = new URLSearchParams("request_no=P260715001");

    expect(productionRequestRedirect(params)).toBe(
      "/petitions/new?request_no=P260715001",
    );
  });
});

describe("isDifferentRequester", () => {
  it("detects a logged-in user that differs from requesterEmail", () => {
    expect(isDifferentRequester("old@example.test", "new@example.test")).toBe(true);
    expect(isDifferentRequester("USER@example.test", "user@example.test")).toBe(false);
  });
});
