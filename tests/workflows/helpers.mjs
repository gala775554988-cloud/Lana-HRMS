import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
export async function load(file, imports = {}) {
  const source = await fs.readFile(new URL('../../' + file, import.meta.url), 'utf8');
  const context = vm.createContext({ Date, structuredClone, URL, URLSearchParams });
  const transpiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  const errors = transpiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error) || [];
  if (errors.length) throw new Error(errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
  const mod = new vm.SourceTextModule(transpiled.outputText, { context });
  await mod.link(async name => {
    if (!imports[name]) throw new Error('Missing test adapter: ' + name);
    const values = imports[name];
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await mod.evaluate();return mod.namespace;
}
