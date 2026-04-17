const fs = require("fs");
const path = require("path");
const ts = require("typescript");

function loadTsModule(modulePath) {
  const resolvedPath = path.resolve(modulePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Module not found: ${resolvedPath}`);
  }

  const source = fs.readFileSync(resolvedPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    },
    fileName: resolvedPath
  });

  const module = { exports: {} };
  const dirname = path.dirname(resolvedPath);

  function localRequire(specifier) {
    if (specifier.startsWith(".")) {
      const nextPath = path.resolve(dirname, specifier);
      const candidatePaths = [nextPath, `${nextPath}.ts`, `${nextPath}.js`];
      const foundPath = candidatePaths.find(candidate => fs.existsSync(candidate));

      if (!foundPath) {
        throw new Error(`Module not found: ${specifier} from ${resolvedPath}`);
      }

      return foundPath.endsWith(".ts")
        ? loadTsModule(foundPath)
        : require(foundPath);
    }

    return require(specifier);
  }

  const compiled = new Function("require", "module", "exports", "__filename", "__dirname", outputText);
  compiled(localRequire, module, module.exports, resolvedPath, dirname);

  return module.exports;
}

module.exports = {
  loadTsModule
};
