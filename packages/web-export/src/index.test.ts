import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportWeb } from "./index";

async function createFixture(): Promise<{ projectDirectory: string; outsideDirectory: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "pointclick-web-export-"));
  const projectDirectory = path.join(root, "project");
  const outsideDirectory = path.join(root, "outside");
  await mkdir(path.join(projectDirectory, "dist", "assets"), { recursive: true });
  await mkdir(path.join(projectDirectory, "assets"), { recursive: true });
  await mkdir(outsideDirectory, { recursive: true });
  await writeFile(
    path.join(projectDirectory, "dist", "index.html"),
    '<script type="module" src="/assets/app.js"></script><img src="../assets/scene.svg">',
    "utf8"
  );
  await writeFile(path.join(projectDirectory, "dist", "assets", "app.js"), "console.log('app');", "utf8");
  await writeFile(path.join(projectDirectory, "assets", "scene.svg"), "<svg />", "utf8");
  await writeFile(path.join(outsideDirectory, "secret.txt"), "do not copy", "utf8");
  return { outsideDirectory, projectDirectory };
}

describe("static web export", () => {
  it("copies assets and rewrites entrypoint URLs relative to the output", async () => {
    const { projectDirectory } = await createFixture();
    const outputDirectory = path.join(path.dirname(projectDirectory), "export");

    const result = await exportWeb({
      projectDirectory,
      outputDirectory,
      browserEntrypoint: { sourcePath: "dist/index.html" },
      assets: [
        { sourcePath: "dist/assets/app.js", outputPath: "assets/app.js" },
        { sourcePath: "assets/scene.svg", outputPath: "assets/scene.svg" }
      ]
    });

    expect(result.entrypointOutputPath).toBe("index.html");
    expect(result.entrypointPath).toBe(path.join(outputDirectory, "index.html"));
    expect(await readFile(path.join(outputDirectory, "index.html"), "utf8")).toBe(
      '<script type="module" src="assets/app.js"></script><img src="assets/scene.svg">'
    );
    expect(await readFile(path.join(outputDirectory, "assets", "app.js"), "utf8")).toBe("console.log('app');");
    expect(await readFile(path.join(outputDirectory, "assets", "scene.svg"), "utf8")).toBe("<svg />");
  });

  it("supports inline entrypoints and nested output paths", async () => {
    const { projectDirectory } = await createFixture();
    const outputDirectory = path.join(path.dirname(projectDirectory), "nested-export");

    await exportWeb({
      projectDirectory,
      outputDirectory,
      browserEntrypoint: {
        contents: '<script type="module" src="./dist/assets/app.js"></script>',
        outputPath: "browser/index.html"
      },
      assets: [{ sourcePath: "dist/assets/app.js", outputPath: "assets/app.js" }]
    });

    expect(await readFile(path.join(outputDirectory, "browser", "index.html"), "utf8")).toBe(
      '<script type="module" src="../assets/app.js"></script>'
    );
  });

  it("rejects absolute and outside-project source paths", async () => {
    const { projectDirectory, outsideDirectory } = await createFixture();
    const outputDirectory = path.join(path.dirname(projectDirectory), "rejected-export");

    await expect(
      exportWeb({
        projectDirectory,
        outputDirectory,
        browserEntrypoint: { contents: "<html></html>" },
        assets: [{ sourcePath: path.join(outsideDirectory, "secret.txt") }]
      })
    ).rejects.toThrow("must be relative");

    await expect(
      exportWeb({
        projectDirectory,
        outputDirectory,
        browserEntrypoint: { contents: "<html></html>" },
        assets: [{ sourcePath: "../outside/secret.txt" }]
      })
    ).rejects.toThrow("outside the allowed root");
  });

  it.skipIf(process.platform === "win32")("rejects outside-project symlinks", async () => {
    const { projectDirectory, outsideDirectory } = await createFixture();
    await symlink(
      path.join(outsideDirectory, "secret.txt"),
      path.join(projectDirectory, "assets", "linked-secret.txt")
    );
    const outputDirectory = path.join(path.dirname(projectDirectory), "rejected-symlink-export");

    await expect(
      exportWeb({
        projectDirectory,
        outputDirectory,
        browserEntrypoint: { contents: "<html></html>" },
        assets: [{ sourcePath: "assets/linked-secret.txt" }]
      })
    ).rejects.toThrow("resolves outside the project");
  });

  it("rejects unsafe output paths", async () => {
    const { projectDirectory } = await createFixture();
    const outputDirectory = path.join(path.dirname(projectDirectory), "rejected-output-export");

    await expect(
      exportWeb({
        projectDirectory,
        outputDirectory,
        browserEntrypoint: { contents: "<html></html>" },
        assets: [{ sourcePath: "assets/scene.svg", outputPath: "../scene.svg" }]
      })
    ).rejects.toThrow("outside the allowed root");

    await expect(
      exportWeb({
        projectDirectory,
        outputDirectory,
        browserEntrypoint: { sourcePath: path.join(projectDirectory, "dist", "index.html") },
        assets: []
      })
    ).rejects.toThrow("must be relative");

    await expect(
      exportWeb({
        projectDirectory,
        outputDirectory,
        browserEntrypoint: { contents: "<html></html>" },
        assets: [{ sourcePath: "assets/scene.svg", outputPath: path.join(outputDirectory, "scene.svg") }]
      })
    ).rejects.toThrow("must be relative");
  });

  it("rejects duplicate output paths", async () => {
    const { projectDirectory } = await createFixture();
    const outputDirectory = path.join(path.dirname(projectDirectory), "duplicate-export");

    await expect(
      exportWeb({
        projectDirectory,
        outputDirectory,
        browserEntrypoint: { contents: "<html></html>" },
        assets: [{ sourcePath: "assets/scene.svg", outputPath: "index.html" }]
      })
    ).rejects.toThrow('is used more than once');
  });

  it("does not copy a directory as an asset", async () => {
    const { projectDirectory } = await createFixture();
    const outputDirectory = path.join(path.dirname(projectDirectory), "directory-export");

    await expect(
      exportWeb({
        projectDirectory,
        outputDirectory,
        browserEntrypoint: { contents: "<html></html>" },
        assets: [{ sourcePath: "assets" }]
      })
    ).rejects.toThrow("must point to a file");
  });
});
