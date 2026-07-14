import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { solveFitScale } from "@/lib/printFit";

// เนื้อหาถูก layout ที่ความกว้าง 1/scale ของกรอบ แล้วค่อย scale ลงมา — ความกว้างที่พิมพ์ออกมาจึงเต็มกรอบเท่าเดิม
// สไตล์เขียนลง DOM ตรงๆ (ไม่ผ่าน state) เพราะ pipeline พิมพ์ serialize ด้วย outerHTML — inline style ต้องติดไปด้วย
export default function FitToBox({
  className,
  style,
  contentClassName,
  contentStyle,
  minScale,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  minScale?: number;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;

    const measure = () => {
      const scale = solveFitScale({
        boxHeight: box.clientHeight,
        minScale,
        measureHeight: (candidate) => {
          content.style.width = `${100 / candidate}%`;
          content.style.minHeight = "0";
          content.style.transform = "none";
          return content.scrollHeight;
        },
      });

      const inversePercent = `${100 / scale}%`;
      content.style.width = inversePercent;
      content.style.minHeight = inversePercent;
      content.style.transform = scale < 1 ? `scale(${scale})` : "none";
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [children, minScale]);

  return (
    <div ref={boxRef} data-fit-box="" className={className} style={style}>
      <div
        ref={contentRef}
        data-fit-content=""
        className={contentClassName}
        style={{ width: "100%", minHeight: "100%", transform: "none", transformOrigin: "top left", ...contentStyle }}
      >
        {children}
      </div>
    </div>
  );
}
