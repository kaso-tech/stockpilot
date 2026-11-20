import { describe, expect, it } from "vitest";
import { isDarkScheduleHour, resolveTheme } from "./themeRules";

describe("règles de thème", () => {
  it("applique la plage sombre qui traverse minuit", () => {
    expect(isDarkScheduleHour(22, 19, 7)).toBe(true);
    expect(isDarkScheduleHour(6, 19, 7)).toBe(true);
    expect(isDarkScheduleHour(12, 19, 7)).toBe(false);
  });

  it("respecte les modes manuel, système et programmé", () => {
    expect(resolveTheme("manual", "light", true, 22, 19, 7)).toBe("light");
    expect(resolveTheme("system", "light", true, 12, 19, 7)).toBe("dark");
    expect(resolveTheme("schedule", "light", false, 22, 19, 7)).toBe("dark");
  });
});
