import type { MagnificationRecord, MagnificationGroup } from "../types";
import { MAGNIFICATION_GROUPS } from "../constants";

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const parseMagnificationValue = (magnification: string): number => {
  const value = parseInt(magnification, 10);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
};

export const groupMagnifications = (
  magnifications: MagnificationRecord[]
): MagnificationGroup[] => {
  const groups = new Map<string, MagnificationRecord[]>();
  magnifications.forEach(record => {
    const key = record.magnification.toLowerCase();
    const list = groups.get(key);
    if (list) {
      list.push(record);
    } else {
      groups.set(key, [record]);
    }
  });

  const standardGroups = MAGNIFICATION_GROUPS.filter(group => groups.has(group));
  const extraGroups = Array.from(groups.keys())
    .filter(group => !(MAGNIFICATION_GROUPS as readonly string[]).includes(group))
    .sort((a, b) => parseMagnificationValue(a) - parseMagnificationValue(b));

  return [...standardGroups, ...extraGroups].map(group => ({
    group,
    records: groups.get(group) as MagnificationRecord[]
  }));
};
