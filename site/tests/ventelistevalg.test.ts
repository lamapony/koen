import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import routes from "./fixtures/ventelistevalg-routes.json";
import { BYDELE, footerLink, kommuneLinks, legendLink, mastheadLink, methodLink, utm } from "../src/funnel/utm";

const allowed = new Set(routes.paths);
function check(href: string) {
  const url = new URL(href);
  expect(url.origin).toBe("https://ventelistevalg.dk");
  expect(allowed.has(url.pathname), href).toBe(true);
  expect(url.searchParams.getAll("utm_source"), href).toEqual(["koen"]);
}
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

describe("Ventelistevalg outbound links", () => {
  it("checks every declared route and each district expansion", () => {
    for (const href of [footerLink(), mastheadLink(), legendLink(), methodLink()]) check(href);
    for (const kode of [...Object.keys(BYDELE), "9999"]) {
      for (const region of ["Region Hovedstaden", "Region Midtjylland"]) {
        const links = kommuneLinks(kode, region);
        for (const href of [links.radar, links.guide, links.andels, links.almene, ...links.bydele.map((b) => b.href)]) {
          if (href) check(href);
        }
      }
    }
  });

  it("checks every utm call in source and rejects unreviewed dynamic paths or direct domain URLs", () => {
    let calls = 0;
    for (const file of files(join(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf8");
      // Outbound links must use the reviewed builder; reject direct domain URLs elsewhere.
      const domains = text.match(/https?:\/\/(?:www\.)?ventelistevalg\.dk[^\s"'`<>]*/gi) ?? [];
      expect(domains, file).toEqual(file.endsWith("/funnel/utm.ts") ? ["https://ventelistevalg.dk"] : []);
      for (const match of text.matchAll(/\butm\(\s*(["'`])([^"'`]+)\1\s*,/g)) {
        calls++;
        const path = match[2];
        if (path.includes("${")) {
          expect(path).toBe("/lister/andels/bydel/${b.slug}");
          for (const districts of Object.values(BYDELE)) for (const district of districts) check(utm(`/lister/andels/bydel/${district.slug}`, "test"));
        } else check(utm(path, "test"));
      }
      // Reject computed utm paths, so new link construction requires an explicit review.
      const callCount = (text.match(/\butm\s*\(/g) ?? []).length - (file.endsWith("/funnel/utm.ts") ? 1 : 0);
      expect(callCount, file).toBe([...text.matchAll(/\butm\(\s*(["'`])([^"'`]+)\1\s*,/g)].length);
    }
    expect(calls).toBeGreaterThan(0);
  });
});
