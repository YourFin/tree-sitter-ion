import type { Dirent } from "@types/node";
import * as IonGrammar from "../../bindings/node";
import Parser from "tree-sitter";
import * as fs from "fs/promises";
import * as path from "path";
import { test, describe, expect } from "vitest";
import { z } from "zod";

IonGrammar.default;

const { ION_TESTS_DIR } = z
  .object({ ION_TESTS_DIR: z.string() })
  .parse(process.env);

function lineNumbers(str: string): string {
  const split = str.split("\n");
  const gutterWidth = split.length.toString().length + 1;
  let result = "";
  let nl = "";
  for (let idx = 0; idx < split.length; idx++) {
    const line = split[idx];
    const spaces = gutterWidth - idx.toString().length;
    result += `${nl}${idx}${" ".repeat(spaces)} | ${line}`;
    nl = "\n";
  }
  return result;
}

async function* walkDir(
  dir: string,
  fileFilter: (fname: string) => boolean,
): AsyncGenerator<{ contentsPromise: Promise<string>; relativeToDir: string }> {
  const children = await fs.readdir(dir, { withFileTypes: true });
  for (const child of children) {
    if (child.isDirectory()) {
      for await (const file of walkDir(
        path.join(dir, child.name),
        fileFilter,
      )) {
        file.relativeToDir = path.join(child.name, file.relativeToDir);
        yield file;
      }
    } else if (child.isFile() && fileFilter(child.name)) {
      yield {
        contentsPromise: fs.readFile(path.join(dir, child.name), {
          encoding: "utf-8",
        }),
        relativeToDir: child.name,
      };
    }
  }
}

const errorNodeQuery = new Parser.Query(IonGrammar.default, "(ERROR) @error");

describe.concurrent("Ion 1_0", async () => {
  describe.concurrent("Good", async () => {
    const gen = walkDir(
      path.join(ION_TESTS_DIR, "iontestdata_1_0", "good"),
      (fname) => fname.endsWith(".ion"),
    );
    for await (const { contentsPromise, relativeToDir } of gen) {
      test(`Parses ${relativeToDir}`, async () => {
        const parser = new Parser();
        parser.setLanguage(IonGrammar.default);
        const contents = await contentsPromise;
        const tree = parser.parse(contents);
        const matches = errorNodeQuery.matches(tree.rootNode);
        for (const match of matches) {
          // TODO: parseable error messages

          console.log(`=== ${relativeToDir} ===`);
          console.log(match.captures[0].node.toString());
          console.log(match.captures[0].node);
          console.log(lineNumbers(match.captures[0].node.tree.input));
        }
        if (matches.length > 0) {
          throw new Error();
        }
        expect(matches).toEqual([]);
      });
    }
  });
  describe.concurrent("Bad", async () => {
    const gen = walkDir(
      path.join(ION_TESTS_DIR, "iontestdata_1_0", "bad"),
      (fname) => fname.endsWith(".ion"),
    );
    for await (const { contentsPromise, relativeToDir } of gen) {
      test(`Rejects ${relativeToDir}`, async () => {
        const parser = new Parser();
        parser.setLanguage(IonGrammar.default);
        const contents = await contentsPromise;
        const tree = parser.parse(contents);
        const matches = errorNodeQuery.matches(tree.rootNode);
        expect(matches).not.toEqual([]);
      });
    }
  });
});
