import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ValidationAiReview from "./ValidationAiReview";
import { requestValidationAi } from "@/lib/validationAi";
vi.mock("@/lib/validationAi", () => ({ requestValidationAi: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it("sends only explicitly submitted text and clears advice when source changes", async () => {
  vi.mocked(requestValidationAi).mockResolvedValue({ summary: "ตรวจค่า Actual", warnings: ["ยังไม่มีหน่วย"], rows: [] });
  render(<ValidationAiReview />);
  const field = screen.getByLabelText("ข้อความให้ AI ทบทวน");
  fireEvent.change(field, { target: { value: "Actual 0.5" } });
  expect(requestValidationAi).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("ส่งข้อความให้ AI ทบทวน"));
  await waitFor(() => expect(screen.getByText("ตรวจค่า Actual")).toBeInTheDocument());
  expect(requestValidationAi).toHaveBeenCalledWith({ mode: "review", text: "Actual 0.5" }, expect.any(AbortSignal));
  fireEvent.change(field, { target: { value: "Actual 0.5 mg/mL" } });
  expect(screen.queryByText("ตรวจค่า Actual")).not.toBeInTheDocument();
});
