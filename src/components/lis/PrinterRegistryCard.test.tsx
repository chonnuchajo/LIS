import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PrinterRegistryCard from "./PrinterRegistryCard";
import { eligiblePrintersForDocument, pickPrinterAssignment, type PrinterConfig } from "@/lib/printConfig";

const config: PrinterConfig = {
  id: "shared", kind: "sticker", label: "Shared", cupsPrinterUrl: "192.168.1.50", isDefault: false,
  assignments: ["ผลิต 2", "ผลิต 4"].map((department) => ({
    department, paperSize: "label-100x50", docTypes: ["sample-label"],
  })),
};

function setup() {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  render(<PrinterRegistryCard configs={[config]} departmentOptions={["ผลิต 2"]}
    onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} onTestPrint={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "แก้ไข" }));
  return onUpdate;
}

describe("shared printer departments", () => {
  it("loads and saves all assigned departments, including ones absent from the directory", async () => {
    const onUpdate = setup();
    expect(screen.getByRole("checkbox", { name: "ผลิต 2" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "ผลิต 4" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("shared", expect.objectContaining({ assignments: config.assignments })));
  });

  it("removes an unchecked department", async () => {
    const onUpdate = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "ผลิต 2" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("shared", expect.objectContaining({ assignments: [config.assignments![1]] })));
  });

  it("requires a department and allows an explicit all-department fallback", async () => {
    const onUpdate = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "ผลิต 2" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "ผลิต 4" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "ผลิต 2" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "ทุกแผนก" }));
    expect(screen.getByRole("checkbox", { name: "ผลิต 2" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("shared", expect.objectContaining({
      assignments: [{ department: "", paperSize: "label-100x50", docTypes: ["sample-label"] }],
    })));
  });

  it("routes both assigned departments to the same printer without including other departments", () => {
    for (const department of ["ผลิต 2", "ผลิต 4"]) {
      expect(pickPrinterAssignment([config], "sample-label", department)?.printer.id).toBe("shared");
      expect(eligiblePrintersForDocument([config], "sample-label", department)).toEqual([config]);
    }
    expect(eligiblePrintersForDocument([config], "sample-label", "ผลิต 3")).toEqual([]);
    expect(pickPrinterAssignment([config], "stock-label", "ผลิต 2")).toBeUndefined();
  });
});
