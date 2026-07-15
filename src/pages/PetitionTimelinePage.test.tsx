import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PetitionTimelinePage from "./PetitionTimelinePage";

const mocks = vi.hoisted(() => ({ props: null as unknown }));

vi.mock("./PetitionListPage", () => ({
  default: (props: unknown) => {
    mocks.props = props;
    return <div data-testid="petition-list-page" />;
  },
}));

describe("PetitionTimelinePage", () => {
  it("uses the petition list with รายการคำร้อง copy and timeline detail destinations", () => {
    render(<PetitionTimelinePage />);

    expect(screen.getByTestId("petition-list-page")).toBeInTheDocument();
    expect(mocks.props).toMatchObject({
      title: "รายการคำร้อง",
      description: "เลือกคำร้องเพื่อติดตามเวลา ความคืบหน้า กิจกรรม และเอกสาร",
    });
    expect((mocks.props as { petitionDetailPath: (petition: { _id: string }) => string }).petitionDetailPath({ _id: "petition-1" })).toBe("/petition/petition-1");
  });
});
