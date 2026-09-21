import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect } from "vitest";
import ValidationLinearityGrid from "./ValidationLinearityGrid";
import { defaultPreparationLevels } from "@/lib/validationPreparation";
it("shows 15 injections without inventing Area and retains entries",()=>{
 function Fixture(){const [value,setValue]=useState("");return <><ValidationLinearityGrid value={value} onChange={setValue} levels={defaultPreparationLevels().filter(l=>l.purpose==="linearity")} stock={2} stocks={[]}/><output data-testid="raw">{value}</output></>;}
 render(<Fixture/>);
 expect(screen.getAllByRole("textbox",{name:/Injection.*Area/})).toHaveLength(15);
 fireEvent.change(screen.getByLabelText("Linearity LV 1 Injection 1 Area"),{target:{value:"25"}});
 const rows=screen.getByTestId("raw").textContent!.split("\n");
 expect(rows).toHaveLength(15);expect(rows[0]).toBe("0.1\t25");expect(rows[1]).toBe("0.1\t");
 fireEvent.change(screen.getByLabelText("Linearity LV 1 Injection 2 Area"),{target:{value:"26"}});
 expect(screen.getByLabelText("Linearity LV 1 Injection 1 Area")).toHaveValue("25");
});
