import { describe, expect, it } from "vitest";
import { escapeAttr, escapeHtml } from "../htmlEscaping.js";

describe("html escaping", () => {
  it("escapes projection and user text before interpolation", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(escapeAttr("\" onfocus=\"x")).toBe("&quot; onfocus=&quot;x");
  });
});

