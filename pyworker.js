/* ═══════════════════════════════════════════════════════════════════
   Runs a student's Python for real, using Pyodide, off the main thread.

   Why a worker: Pyodide is a ~10 MB download and runs synchronously, so on
   the main thread a slow boot or an endless `while True:` would freeze the
   whole page. In here the page stays responsive and games.html can simply
   terminate the worker when an answer takes too long.

   Protocol — the page posts { id, warm } to pre-load, or
   { id, src, check, stdin } to grade, and gets back one of:
     { id, ready:true }              the runtime is up
     { id, ok:true }                 every assertion in `check` passed
     { id, ok:false, err }           an assertion failed / the code raised
     { id, fatal }                   Pyodide itself could not start
   Nothing here trusts `src`: it is the user's own code, in their own browser,
   inside Pyodide's sandbox — it has no DOM, no network and no page access.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";

const PYODIDE_VERSION = "0.26.4";
const BASE = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

let py = null, booting = null;
function boot() {
  if (py) return Promise.resolve(py);
  if (!booting) {
    booting = (async () => {
      importScripts(BASE + "pyodide.js");
      py = await loadPyodide({ indexURL: BASE });
      py.runPython(HARNESS);
      return py;
    })();
  }
  return booting;
}

/* Runs the student's code in its own namespace with stdout captured, then runs
   the task's assertions in that same namespace so they can call whatever the
   student defined. `OUT` holds anything the student printed. */
const HARNESS = `
import io, contextlib, json

def __syntax(src):
    """Compile only — never execute. Catches SyntaxError / IndentationError /
    TabError, which is exactly what an editor's syntax check reports. A logic
    error compiles perfectly well, so nothing here will notice one."""
    try:
        compile(src, '<answer>', 'exec')
        return ''
    except SyntaxError as e:
        return json.dumps({'msg': e.msg or 'invalid syntax', 'line': e.lineno or 0})
    except Exception as e:
        return json.dumps({'msg': str(e), 'line': 0})

def __run(src, check, stdin_json):
    ns = {}
    if stdin_json:
        _vals = iter(json.loads(stdin_json))
        ns['input'] = lambda *a: next(_vals, '')
    _buf = io.StringIO()
    with contextlib.redirect_stdout(_buf):
        exec(src, ns)
    ns['OUT'] = _buf.getvalue()
    exec(check, ns)
`;

/* Python tracebacks are long; the last line is the part that helps. */
function lastLine(msg) {
  const lines = String(msg || "").trim().split("\n").map(s => s.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "Error";
}

self.onmessage = async (e) => {
  const { id, src, check, stdin, warm, syntax } = e.data || {};
  let p;
  try {
    p = await boot();
  } catch (err) {
    self.postMessage({ id, fatal: String((err && err.message) || err) });
    return;
  }
  if (warm) { self.postMessage({ id, ready: true }); return; }

  if (syntax !== undefined) {                 // compile-only check, runs nothing
    const fn = p.globals.get("__syntax");
    try {
      const out = fn(syntax);
      self.postMessage({ id, ok: true, syntaxErr: out ? JSON.parse(out) : null });
    } catch (err) {
      self.postMessage({ id, ok: true, syntaxErr: null });
    } finally { if (fn && fn.destroy) fn.destroy(); }
    return;
  }

  const run = p.globals.get("__run");
  try {
    run(src, check, stdin ? JSON.stringify(stdin) : "");
    self.postMessage({ id, ok: true });
  } catch (err) {
    self.postMessage({ id, ok: false, err: lastLine((err && err.message) || err) });
  } finally {
    if (run && run.destroy) run.destroy();
  }
};
