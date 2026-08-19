import { StoryBody } from "@sugt/story-format/story-body";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * **The render half of ADR-0015's one list.** `StoryBody` must render exactly what the editor's
 * schema can produce and drop everything else — structurally, so a pasted image or a smuggled tag
 * cannot reach the public page through the body. These render the component to static HTML and check
 * the boundary from both sides: what survives, and what is gone.
 */
function render(markdown: string): string {
  return renderToStaticMarkup(<StoryBody markdown={markdown} />);
}

describe("what the allowlist permits", () => {
  it("renders emphasis, strong, headings, lists, blockquotes and links", () => {
    const html = render(
      [
        "## Judul",
        "",
        "**tebal** dan *miring*",
        "",
        "- satu",
        "- dua",
        "",
        "> kutipan",
        "",
        "[tautan](https://contoh.id)",
      ].join("\n"),
    );

    expect(html).toContain("<h2");
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain('href="https://contoh.id"');
    // External links close the referrer leak the renderer owns.
    expect(html).toContain('rel="noreferrer"');
  });
});

describe("what the allowlist drops", () => {
  it("drops an image — photographs live in the gallery, never the body", () => {
    const html = render("![alt](https://contoh.id/foto.png)");
    expect(html).not.toContain("<img");
  });

  it("drops a code block and inline code — a field account is not source code", () => {
    const html = render(["```", "kode()", "```", "", "dan `inline` juga"].join("\n"));
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("<code");
  });

  it("never lets raw HTML through — an allowlist bypass by construction", () => {
    const html = render('<script>alert(1)</script> <div class="x">halo</div>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<div class=");
  });
});
