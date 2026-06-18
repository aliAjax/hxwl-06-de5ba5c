import { describe, it, expect } from "vitest";
import { render, screen } from "../test/testUtils";
import { QualityBadge } from "./QualityBadge";

describe("QualityBadge", () => {
  it("pass 状态应显示质量达标", () => {
    render(<QualityBadge status="pass" />);
    const badge = screen.getByText("质量达标");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("quality-badge");
    expect(badge).toHaveClass("quality-badge-pass");
  });

  it("warning 状态应显示待改进", () => {
    render(<QualityBadge status="warning" />);
    const badge = screen.getByText("待改进");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("quality-badge-warning");
  });

  it("error 状态应显示质量问题", () => {
    render(<QualityBadge status="error" />);
    const badge = screen.getByText("质量问题");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("quality-badge-error");
  });
});
