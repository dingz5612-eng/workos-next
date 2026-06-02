import { describe, expect, it } from "vitest";
import { escapeAttr, escapeHtml } from "../htmlEscaping.js";

describe("html escaping", () => {
  it("escapes projection and user text before interpolation", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(escapeAttr("\" onfocus=\"x")).toBe("&quot; onfocus=&quot;x");
    const payload = `"><img src=x onerror="alert(1)"><a href="javascript:alert(1)">`;
    const escaped = escapeAttr(payload);
    expect(escaped).toContain("&quot;&gt;&lt;img");
    expect(escaped).not.toContain("<img");
    expect(escaped).not.toContain("onerror=\"");
    expect(escaped).not.toContain("<a href=");
  });
});
