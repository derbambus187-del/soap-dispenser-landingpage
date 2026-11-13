import { describe, expect, it } from "vitest";
import { isAllowedBrowserUrl, resolveDirectBrowserRequest } from "../src/browser-actions.js";

describe("browser actions", () => {
  it("opens YouTube and Discord only after a clear open request", () => {
    expect(resolveDirectBrowserRequest("Öffne YouTube")).toMatchObject({
      url: "https://www.youtube.com/",
    });
    expect(resolveDirectBrowserRequest("Kannst du Discord starten?")).toMatchObject({
      url: "https://discord.com/app",
    });
    expect(resolveDirectBrowserRequest("Erklär mir, was Discord ist.")).toBeUndefined();
    expect(resolveDirectBrowserRequest("Öffne nicht YouTube.")).toBeUndefined();
  });

  it("opens a supplied Discord channel link but asks for a link if the channel is ambiguous", () => {
    expect(resolveDirectBrowserRequest("Öffne diesen Discord-Channel https://discord.com/channels/123/456."))
      .toMatchObject({ url: "https://discord.com/channels/123/456" });
    expect(resolveDirectBrowserRequest("Öffne den Discord-Kanal für Minecraft")?.response)
      .toContain("brauche ich den Channel-Link");
  });

  it("rejects links to unknown sites and unsafe Discord destinations", () => {
    expect(isAllowedBrowserUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isAllowedBrowserUrl("https://example.com")).toBe(false);
    expect(isAllowedBrowserUrl("https://discord.com/settings")).toBe(false);
    expect(isAllowedBrowserUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedBrowserUrl("https://discord.com.evil.example/channels/123/456")).toBe(false);
  });
});
