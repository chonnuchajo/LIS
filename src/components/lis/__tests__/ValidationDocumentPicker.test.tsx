import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ValidationDocumentPicker from "../ValidationDocumentPicker";

const { openDocument, dispose } = vi.hoisted(() => ({ openDocument: vi.fn(), dispose: vi.fn(async () => {}) }));
vi.mock("@/lib/validationDocuments", () => ({ openValidationDocument: openDocument }));

describe("เลือกข้อมูลจากเอกสาร", () => {
  it("requires PDF review and resets the reviewed draft when range changes", async () => {
    openDocument.mockResolvedValue({ name: "report.pdf", kind: "pdf", parts: ["หน้า 1"], dispose, readPart: async () => ({ rows: [["500", "125"], ["501", "126"]], warning: "ตรวจต้นฉบับ" }) });
    const select = vi.fn();
    const view = render(<ValidationDocumentPicker columns={["Actual", "Area"]} onSelect={select} />);
    fireEvent.change(screen.getByLabelText("ไฟล์ Excel หรือ PDF"), { target: { files: [new File(["pdf"], "report.pdf")] } });
    await screen.findByLabelText("คอลัมน์ต้นทางสำหรับ Actual");
    fireEvent.change(screen.getByLabelText("คอลัมน์ต้นทางสำหรับ Actual"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("คอลัมน์ต้นทางสำหรับ Area"), { target: { value: "1" } });
    const apply = screen.getByRole("button", { name: "ใช้ช่วงนี้ในตัวอย่างนำเข้า" });
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByLabelText("ตรวจเทียบช่วงแถวและคอลัมน์กับหน้า PDF ต้นฉบับแล้ว"));
    fireEvent.click(apply);
    expect(select).toHaveBeenLastCalledWith("500\t125\n501\t126");
    fireEvent.click(screen.getByLabelText("ตรวจเทียบช่วงแถวและคอลัมน์กับหน้า PDF ต้นฉบับแล้ว"));
    expect(select).toHaveBeenLastCalledWith("");
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByLabelText("ตรวจเทียบช่วงแถวและคอลัมน์กับหน้า PDF ต้นฉบับแล้ว"));
    fireEvent.click(apply);
    fireEvent.change(screen.getByLabelText("แถวเริ่มต้น"), { target: { value: "2" } });
    expect(select).toHaveBeenLastCalledWith("");
    expect(apply).toBeDisabled();
    view.unmount();
    await waitFor(() => expect(dispose).toHaveBeenCalled());
  });
});
