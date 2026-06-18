import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  formatDate,
  parseMagnificationValue,
  groupMagnifications,
} from "./format";
import type { MagnificationRecord } from "../types";

describe("formatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00Z"));
  });

  it("应格式化日期为中文格式", () => {
    const result = formatDate("2026-01-15T10:30:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("01");
    expect(result).toContain("15");
  });

  it("应包含日期和时间部分", () => {
    const result = formatDate("2026-01-15T08:45:00Z");
    expect(result.length).toBeGreaterThan(0);
  });

  it("处理无效日期字符串不应抛出错误", () => {
    expect(() => formatDate("invalid-date")).not.toThrow();
  });
});

describe("parseMagnificationValue", () => {
  it("应正确解析标准倍率格式", () => {
    expect(parseMagnificationValue("100x")).toBe(100);
    expect(parseMagnificationValue("400x")).toBe(400);
    expect(parseMagnificationValue("1000x")).toBe(1000);
  });

  it("应正确解析纯数字字符串", () => {
    expect(parseMagnificationValue("100")).toBe(100);
    expect(parseMagnificationValue("400")).toBe(400);
  });

  it("处理非数字字符串应返回最大安全整数", () => {
    expect(parseMagnificationValue("abc")).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseMagnificationValue("")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("应处理大写X的格式", () => {
    expect(parseMagnificationValue("400X")).toBe(400);
  });
});

describe("groupMagnifications", () => {
  const createRecord = (
    id: string,
    magnification: string
  ): MagnificationRecord => ({
    id,
    magnification,
    observedStructure: "测试结构",
    fieldDescription: "测试描述",
    createdAt: "2026-01-01T00:00:00Z",
  });

  it("应按倍率分组记录", () => {
    const records = [
      createRecord("1", "100x"),
      createRecord("2", "400x"),
      createRecord("3", "100x"),
    ];
    const groups = groupMagnifications(records);
    expect(groups.length).toBe(2);
    expect(groups.find((g) => g.group === "100x")?.records.length).toBe(2);
    expect(groups.find((g) => g.group === "400x")?.records.length).toBe(1);
  });

  it("应忽略倍率大小写进行分组", () => {
    const records = [
      createRecord("1", "100x"),
      createRecord("2", "100X"),
    ];
    const groups = groupMagnifications(records);
    expect(groups.length).toBe(1);
    expect(groups[0].records.length).toBe(2);
  });

  it("空数组应返回空分组", () => {
    const groups = groupMagnifications([]);
    expect(groups).toEqual([]);
  });

  it("标准倍率应按预设顺序排列", () => {
    const records = [
      createRecord("1", "400x"),
      createRecord("2", "100x"),
      createRecord("3", "200x"),
    ];
    const groups = groupMagnifications(records);
    const groupNames = groups.map((g) => g.group);
    const standardOrder = ["100x", "200x", "400x"];
    const standardInResult = groupNames.filter((g) =>
      standardOrder.includes(g)
    );
    expect(standardInResult).toEqual(["100x", "200x", "400x"]);
  });
});
