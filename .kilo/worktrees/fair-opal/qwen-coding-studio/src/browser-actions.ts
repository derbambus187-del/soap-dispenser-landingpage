export type DirectBrowserRequest = {
  url: string;
  response: string;
};

const allowedHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "discord.com",
  "www.discord.com",
  "discord.gg",
]);

export function isAllowedBrowserUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !allowedHosts.has(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return false;
    }

    if (url.hostname.toLowerCase().endsWith("discord.com")) {
      return /^\/(?:app|channels(?:\/|$)|invite\/)/.test(url.pathname);
    }
    if (url.hostname.toLowerCase() === "discord.gg") {
      return /^\/[A-Za-z0-9-]+\/?$/.test(url.pathname);
    }
    return true;
  } catch {
    return false;
  }
}

export function resolveDirectBrowserRequest(prompt: string): DirectBrowserRequest | undefined {
  if (
    /(?:nicht|kein(?:e|en)?|don't|do not|not|never)\s+(?:öffne|öffnen|starte|starten|open|launch)|(?:öffne|öffnen|starte|starten|open|launch).{0,30}\bnicht\b/i.test(prompt)
  ) {
    return undefined;
  }

  const hasOpenVerb = /(?:öffne|öffnen|starte|starten|geh(?:e)?|ruf(?:e)?|open|launch)/i.test(prompt);
  if (!hasOpenVerb) {
    return undefined;
  }
  const intent = prompt;

  const link = intent.match(/https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|discord\.com|discord\.gg)\/[^\s"'<>]*/i)?.[0]
    ?.replace(/[),.!?;]+$/, "");
  if (link && isAllowedBrowserUrl(link)) {
    const site = new URL(link).hostname;
    return { url: link, response: `${site} in einem neuen Browser-Tab geöffnet.` };
  }

  if (/\b(?:youtube|youtu\.be)\b/i.test(intent)) {
    return { url: "https://www.youtube.com/", response: "YouTube in einem neuen Browser-Tab geöffnet." };
  }
  if (/discord/i.test(intent)) {
    return {
      url: "https://discord.com/app",
      response: /channel|kanal/i.test(intent)
        ? "Discord geöffnet. Für einen bestimmten Kanal brauche ich den Channel-Link."
        : "Discord in einem neuen Browser-Tab geöffnet.",
    };
  }

  return undefined;
}
