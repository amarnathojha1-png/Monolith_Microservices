/**
 * Task 1 - build this.
 *
 * Walk every .ts file under src/modules and look at its imports.
 * A module may import:
 *   - its own files
 *   - anything under src/platform
 *   - another module's index.ts  -  and nothing else
 *
 * Anything else is a violation.
 *
 * Running this file directly should print the violations and exit 1 when
 * there are any, 0 when there are none.
 *
 * No dependencies. node:fs and node:path are enough. Remember that a
 * type-only import still couples one module to another.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface Violation {
  file: string;
  importPath: string;
  reason: string;
}

function listTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

function stripComments(source: string): string {
  return source.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g,
    (match, literal: string | undefined) => literal ?? " ".repeat(match.length),
  );
}

function findImports(source: string): string[] {
  const code = stripComments(source);
  const imports: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s*(['"])([^'"\r\n]+)\1/g,
    /\bimport\s*(['"])([^'"\r\n]+)\1/g,
    /\b(?:import|require)\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      imports.push(match[2]);
    }
  }

  return imports;
}

function resolveImportPath(importer: string, importPath: string): string | null {
  if (!importPath.startsWith(".")) {
    return null;
  }

  const resolved = path.resolve(path.dirname(importer), importPath);
  if (path.extname(resolved)) {
    return resolved;
  }

  for (const candidate of [resolved, `${resolved}.ts`, path.join(resolved, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return resolved;
}

function isWithin(directory: string, candidate: string): boolean {
  const relative = path.relative(directory, candidate);
  return relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function getModuleRoot(modulesRoot: string, file: string): string {
  const relative = path.relative(modulesRoot, file);
  const segments = relative.split(path.sep);
  return segments.length > 1 ? path.join(modulesRoot, segments[0]) : modulesRoot;
}

export function findViolations(root: string): Violation[] {
  const absoluteRoot = path.resolve(root);
  const sourceRoot = path.basename(absoluteRoot) === "modules"
    ? path.dirname(absoluteRoot)
    : absoluteRoot;
  const modulesRoot = path.join(sourceRoot, "modules");
  const platformRoot = path.join(sourceRoot, "platform");
  const violations: Violation[] = [];

  for (const file of listTypeScriptFiles(modulesRoot)) {
    const moduleRoot = getModuleRoot(modulesRoot, file);

    for (const importPath of findImports(readFileSync(file, "utf8"))) {
      const target = resolveImportPath(file, importPath);
      const isPublicModuleIndex = target !== null &&
        isWithin(modulesRoot, target) &&
        path.basename(target) === "index.ts" &&
        path.dirname(path.dirname(target)) === modulesRoot;

      if (
        target !== null &&
        (isWithin(moduleRoot, target) || isWithin(platformRoot, target) || isPublicModuleIndex)
      ) {
        continue;
      }

      violations.push({
        file: path.relative(sourceRoot, file),
        importPath,
        reason: "imports must stay within the module, use src/platform, or target another module's index.ts",
      });
    }
  }

  return violations;
}

const invokedPath = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
  const violations = findViolations(sourceRoot);

  for (const { file, importPath, reason } of violations) {
    console.error(`${file} -> ${importPath}: ${reason}`);
  }

  if (violations.length > 0) {
    process.exitCode = 1;
  }
}
