import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RoleEditDialog from "./RoleEditDialog";

describe("RoleEditDialog", () => {
  it("submits the selected Lab family when creating a role", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="create"
        role={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Role name"), { target: { value: "Lab Head" } });
    fireEvent.change(screen.getByLabelText("Role description"), { target: { value: "Approves Lab work" } });
    fireEvent.click(screen.getByLabelText("Lab"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Lab Head",
      description: "Approves Lab work",
      family: "lab",
    });
  });

  it("loads and submits the existing QC family when editing a role", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="edit"
        role={{ id: "qc-head", name: "QC Head", description: "Approves QC work", family: "qc" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("QC")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "QC Head",
      description: "Approves QC work",
      family: "qc",
    });
  });

  it("infers and submits the Lab family for a legacy lab-prefixed role", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="edit"
        role={{ id: "lab-head", name: "Lab Head", description: "Approves Lab work" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("Lab")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Lab Head",
      description: "Approves Lab work",
      family: "lab",
    });
  });

  it("preserves an explicit blank family for a legacy lab-prefixed role", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="edit"
        role={{ id: "lab-head", name: "Lab Head", description: "", family: "" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("Not Lab/QC")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Lab Head",
      description: "",
      family: "",
    });
  });

  it("infers and submits the QC family for a legacy qc-prefixed role", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="edit"
        role={{ id: "qc_staff", name: "QC Staff", description: "Checks QC work" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("QC")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "QC Staff",
      description: "Checks QC work",
      family: "qc",
    });
  });

  it("submits a blank family for roles outside Lab and QC", () => {
    const onSubmit = vi.fn();

    render(
      <RoleEditDialog
        open
        mode="create"
        role={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Role name"), { target: { value: "Production" } });
    fireEvent.click(screen.getByLabelText("Not Lab/QC"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Production",
      description: "",
      family: "",
    });
  });
});
