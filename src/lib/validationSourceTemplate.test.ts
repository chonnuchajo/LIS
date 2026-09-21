import { expect, it } from "vitest";
import { sourceTemplate, sourceTextHtml } from "./validationSourceTemplate";

it("retains the source wording while identifying all eight replaceable result tables", () => {
  expect(sourceTemplate.sourcePageCount).toBe(24);
  expect(sourceTemplate.blocks.filter(b => b.type === "table").map(b => b.number)).toEqual([1,2,3,4,5,6,7,8]);
  for (const block of sourceTemplate.blocks.filter(b => b.type === "text")) {
    const restored = block.template!.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => key === "analyte" ? "Cypermethrin" : sourceTemplate.variables[key as keyof typeof sourceTemplate.variables].original);
    expect(restored).toBe(block.source);
  }
});

it("reflows PDF line wraps without treating decimal results as section headings", () => {
  const html = sourceTextHtml("8.3 ความถูกต้อง\nข้อความต่อเนื่อง\nที่มาจากบรรทัดถัดไป\n0.12345 ตามลำดับ\n\n3.1 Reference author\ncontinued title");
  expect(html).toContain('<h3 class="source-h3">8.3 ความถูกต้อง</h3>');
  expect(html).toContain("ข้อความต่อเนื่อง ที่มาจากบรรทัดถัดไป 0.12345 ตามลำดับ");
  expect(html).toContain('<p class="source-p">3.1 Reference author continued title</p>');
});
