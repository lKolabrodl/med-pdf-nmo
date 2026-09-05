import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {loadDataset} from "./cases.js";
import {DATASET_ALIASES} from "./dataset-manifest.js";

const temporaryRoots: string[] = [];
const fixture = 'runCase({question:"Synthetic question",variants:["One","Two"],expected:["One"],type:"single"});';

async function aliasFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nmo-alias-test-"));
  temporaryRoots.push(root);
  const [alias, canonical] = Object.entries(DATASET_ALIASES)[0];
  for (const name of [alias, canonical]) {
    const directory = path.join(root, "__test__", name);
    await fs.mkdir(directory, {recursive: true});
    await fs.writeFile(path.join(directory, "doc.pdf"), "identical synthetic PDF bytes");
    await fs.writeFile(path.join(directory, "cases.test.ts"), fixture);
  }
  return {root, alias, canonical};
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    const prefix = path.join(os.tmpdir(), "nmo-alias-test-");
    if (!path.resolve(root).startsWith(path.resolve(prefix))) throw new Error("Unexpected cleanup target");
    await fs.rm(root, {recursive: true, force: true});
  }
});

describe("verified dataset aliases", () => {
  it("counts an exact duplicate only under its canonical group", async () => {
    const {root, alias, canonical} = await aliasFixture();
    const dataset = await loadDataset(root);
    expect(dataset.groups).toEqual([canonical]);
    expect(dataset.cases).toHaveLength(1);
    expect(dataset.aliases).toEqual({[alias]: canonical});
  });
  it("rejects a duplicate name with different PDF content", async () => {
    const {root, alias} = await aliasFixture();
    await fs.writeFile(path.join(root, "__test__", alias, "doc.pdf"), "different bytes");
    await expect(loadDataset(root)).rejects.toThrow("differs");
  });
  it("rejects changed labels rather than silently discarding them", async () => {
    const {root, alias} = await aliasFixture();
    await fs.writeFile(path.join(root, "__test__", alias, "cases.test.ts"), fixture.replace('expected:["One"]', 'expected:["Two"]'));
    await expect(loadDataset(root)).rejects.toThrow("differs");
  });
});
