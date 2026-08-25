import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Petition } from "@/types/petition.types";
import SampleLabelPrintTemplate from "./SampleLabelPrintTemplate";

function petitionWith(item: Partial<Petition["items"][number]>): Petition {
  return {
    _id: "petition-1",
    petitionNo: "P-2607-0001",
    dept: "production",
    status: "inProgress",
    submittedBy: { name: "ทดสอบระบบ" },
    items: [{ seq: 1, sampleName: "", commonName: "", ...item }],
  } as Petition;
}

describe("SampleLabelPrintTemplate", () => {
  it("ไม่พิมพ์ชื่อผลิตภัณฑ์ซ้ำเมื่อ sampleName กับ commonName เหมือนกัน", () => {
    render(<SampleLabelPrintTemplate petition={petitionWith({
      sampleName: "PROCHLORAZ 45% W/V EC",
      commonName: "PROCHLORAZ 45% W/V EC",
    })} />);

    expect(screen.getByText("PROCHLORAZ 45% W/V EC")).toBeInTheDocument();
  });

  it("ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างหัวท้ายตอนเทียบชื่อซ้ำ", () => {
    render(<SampleLabelPrintTemplate petition={petitionWith({
      sampleName: " prochloraz 45% w/v ec ",
      commonName: "PROCHLORAZ 45% W/V EC",
    })} />);

    expect(screen.getByText("prochloraz 45% w/v ec")).toBeInTheDocument();
  });

  it("ยังแสดงทั้งสองชื่อเมื่อต่างกันจริง", () => {
    render(<SampleLabelPrintTemplate petition={petitionWith({
      sampleName: "โบรมาดิโอโลน - อ.ย.",
      commonName: "BROMADIOLONE 0.005% W/W",
    })} />);

    expect(screen.getByText("โบรมาดิโอโลน - อ.ย. BROMADIOLONE 0.005% W/W")).toBeInTheDocument();
  });

  it("ไม่แสดงค่า Uncertainty บนฉลากตัวอย่าง", () => {
    const petition = {
      ...petitionWith({ sampleName: "PROCHLORAZ 45% W/V EC", batchNo: "B-001" }),
      labRequests: [{ serviceAgreement: { requireUncertainty: true, uncertaintyValue: "±0.12" } }],
    } as unknown as Petition;

    const { container } = render(<SampleLabelPrintTemplate petition={petition} />);

    expect(container).not.toHaveTextContent("Uncertainty");
    expect(container).not.toHaveTextContent("±0.12");
  });
});
