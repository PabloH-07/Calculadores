
const $ = (id) => document.getElementById(id);
const fmt = (n) => String(parseFloat(n.toPrecision(12)));

function show(el, msg, isErr) {
  el.textContent = msg;
  el.classList.toggle("err", !!isErr);
}
function guard(el, fn) {
  try {
    show(el, fn());
  } catch (e) {
    show(el, e.message, true);
  }
} 
function evaluate(src, x) {
  const s = src
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt");
 
  const re = /\s*(\d+\.?\d*|\.\d+|[a-z]+|[-+*\/^(),])/y;
  const t = [];
  let pos = 0;
 
  while (pos < s.length && s.slice(pos).trim()) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) throw new Error("Entrada inválida");
    t.push(m[1]);
    pos = re.lastIndex;
  }
  let i = 0;
 
  const F = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    sqrt: Math.sqrt,
    ln: Math.log,
    log: Math.log10,
    abs: Math.abs,
    exp: Math.exp,
  };
  const bad = () => {
    throw new Error("Entrada inválida");
  };
  function expr() {
    let v = term();
    while (t[i] === "+" || t[i] === "-") {
      const op = t[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    while (t[i] === "*" || t[i] === "/") {
      const op = t[i++];
      const r = unary();
      if (op === "/") {
        if (r === 0) throw new Error("Divisão por zero");
        v /= r;
      } else {
        v *= r;
      }
    }
    return v;
  }
  function unary() {
    if (t[i] === "-") {
      i++;
      return -unary();
    }
    if (t[i] === "+") {
      i++;
      return unary();
    }
    return pow();
  }
  function pow() {
    const base = atom();
    if (t[i] === "^") {
      i++;
      return Math.pow(base, unary());
    }
    return base;
  }
  function atom() {
    const k = t[i++];
    if (k === undefined) bad();
 
    if (/^[\d.]/.test(k)) return parseFloat(k);
 
    if (k === "(") {
      const v = expr();
      if (t[i++] !== ")") bad();
      return v;
    }
 
    if (k === "pi") return Math.PI;
    if (k === "e") return Math.E;
 
    if (k === "x") {
      if (x === undefined || isNaN(x)) bad();
      return x;
    }
 
    if (F[k]) {
      if (t[i++] !== "(") bad();
      const v = expr();
      if (t[i++] !== ")") bad();
 
      const foraDoDominio =
        (k === "sqrt" && v < 0) ||
        ((k === "ln" || k === "log") && v <= 0);
      if (foraDoDominio) throw new Error("Fora do domínio");
 
      return F[k](v);
    }
 
    bad();
  }
 
  const r = expr();
  if (i < t.length) bad();
  if (!isFinite(r)) throw new Error("Resultado fora do intervalo");
  return r;
}
const panels = [
  ["basica", "Básica"],
  ["funcoes", "Funções"],
  ["matrizes", "Matrizes"],
  ["comb", "Combinatória"],
  ["bases", "Bases"],
];
 
panels.forEach(([id, name], n) => {
  const b = document.createElement("button");
  b.textContent = name;
  b.setAttribute("role", "tab");
  b.setAttribute("aria-selected", n === 0);
 
  b.onclick = () => {
    panels.forEach(([p], j) => {
      $("p-" + p).hidden = j !== n;
      $("tabs").children[j].setAttribute("aria-selected", j === n);
    });
  };
 
  $("tabs").append(b);
});
 
let ex = "";       
let done = false; 
 
const keys = [
  ["sin(", "sc"], ["cos(", "sc"], ["tan(", "sc"], ["√(", "sc"],
  ["ln(", "sc"],  ["log(", "sc"], ["^", "sc"],    ["π", "sc"],
  ["CE", "op"],   ["C", "op"],    ["⌫", "op"],    ["÷", "op"],
  ["(", ""],      [")", ""],      ["±", "op"],    ["×", "op"],
  ["7", ""],      ["8", ""],      ["9", ""],      ["−", "op"],
  ["4", ""],      ["5", ""],      ["6", ""],      ["+", "op"],
  ["1", ""],      ["2", ""],      ["3", ""],      ["=", "eq"],
  ["0", ""],      [".", ""],      ["e", "sc"],
];
 
function render(res, err) {
  show($("bex"), ex);
  if (res !== undefined) show($("brs"), res, err);
}
 
function press(k) {
  if (k === "=") {
    try {
      const r = fmt(evaluate(ex));
      $("bex").textContent = ex + " =";
      show($("brs"), r);
      ex = r;
      done = true;
    } catch (e) {
      show($("brs"), e.message, true);
    }
    return;
  }
  const comecaNovaConta =
    done && /^[\d.π(]|^(sin|cos|tan|√|ln|log)/.test(k) && k !== "±";
  if (comecaNovaConta) ex = "";
  done = false;
 
  if (k === "C") {
    ex = "";
    render("0");
    return;
  }
  if (k === "CE") {
    ex = ex.replace(/(\(-)?(\d+\.?\d*|\.\d+|[π])\)?$/, "");
    render("0");
    return;
  }
  if (k === "⌫") {
    ex = ex.replace(/(sin|cos|tan|ln|log)\($|√\($|.$/, "");
    render(ex || "0");
    return;
  }
 
  if (k === "±") {
    if (/\(-(\d+\.?\d*|\.\d+)\)$/.test(ex)) {
      ex = ex.replace(/\(-(\d+\.?\d*|\.\d+)\)$/, "$1");
    } else if (/(\d+\.?\d*|\.\d+)$/.test(ex)) {
      ex = ex.replace(/(\d+\.?\d*|\.\d+)$/, "(-$1)");
    } else if (ex === "") {
      ex = "(-";
    }
    render(ex);
    return;
  }
 
  ex += k;
  render(ex);
}
keys.forEach(([k, c]) => {
  const b = document.createElement("button");
  b.textContent = k;
  b.className = c;
  b.setAttribute("aria-label", k);
  b.onclick = () => press(k);
  $("bpad").append(b);
});
document.addEventListener("keydown", (e) => {
  if ($("p-basica").hidden || /INPUT|SELECT/.test(e.target.tagName)) return;
 
  const map = {
    "*": "×",
    "/": "÷",
    "-": "−",
    Enter: "=",
    "=": "=",
    Backspace: "⌫",
    Escape: "C",
    Delete: "CE",
  };
 
  const k = map[e.key] || e.key;
  if (/^[\d.+()^]$/.test(k) || Object.values(map).includes(k)) {
    e.preventDefault();
    press(k);
  }
});
$("fgo").onclick = () =>
  guard($("fout"), () => {
    const x = parseFloat($("xv").value.replace(",", "."));
    if (isNaN(x)) {
      throw new Error("Entrada inválida: x precisa ser um número");
    }
    return "f(" + fmt(x) + ") = " + fmt(evaluate($("fx").value, x));
  });
const rotulosSelect = {
  ar: "Linhas de A",
  ac: "Colunas de A",
  br: "Linhas de B",
  bc: "Colunas de B",
};
["ar", "ac", "br", "bc"].forEach((id) => {
  const s = $(id);
  s.setAttribute("aria-label", rotulosSelect[id]);
 
  for (let n = 1; n <= 5; n++) {
    s.add(new Option((id[1] === "r" ? "Linhas " : "Colunas ") + n, n));
  }
 
  s.value = 3;
  s.onchange = () => grid(id[0]);
});
function readRaw(w) {
  const g = $("g" + w).querySelector(".mx");
  if (!g) return [];
 
  const rows = +g.dataset.r || 0;
  const cols = +g.dataset.c || 0;
  const inputs = g.querySelectorAll("input");
  const old = [];
 
  for (let i = 0; i < rows; i++) {
    old[i] = [];
    for (let j = 0; j < cols; j++) {
      old[i][j] = inputs[i * cols + j].value;
    }
  }
  return old;
}
function grid(w) {
  const rows = +$(w + "r").value;
  const cols = +$(w + "c").value;
  const old = readRaw(w);
  const box = $("g" + w);
 
  box.innerHTML = "";
 
  const d = document.createElement("div");
  d.className = "mx";
  d.style.gridTemplateColumns = `repeat(${cols}, auto)`;
  d.dataset.r = rows;
  d.dataset.c = cols;
 
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const inp = document.createElement("input");
      inp.inputMode = "decimal";
      inp.setAttribute("aria-label", `${w.toUpperCase()}[${i + 1},${j + 1}]`);
 
      const antigo = old[i] && old[i][j];
      inp.value = antigo !== undefined ? antigo : i === j ? "1" : "0";
 
      d.append(inp);
    }
  }
  box.append(d);
}
function read(w) {
  const rows = +$(w + "r").value;
  const cols = +$(w + "c").value;
  const inputs = $("g" + w).querySelectorAll("input");
  const M = [];
 
  for (let i = 0; i < rows; i++) {
    M[i] = [];
    for (let j = 0; j < cols; j++) {
      const v = inputs[i * cols + j].value.trim().replace(",", ".");
      if (v === "" || isNaN(+v)) {
        throw new Error(
          `Entrada inválida em ${w.toUpperCase()}[${i + 1},${j + 1}]`
        );
      }
      M[i][j] = +v;
    }
  }
  return M;
}
function det(M) {
  const n = M.length;
  const A = M.map((r) => r.slice());
  let d = 1;
 
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    }
    if (Math.abs(A[p][c]) < 1e-12) return 0;
 
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      d = -d;
    }
 
    d *= A[c][c];
 
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return d;
}
function table(M) {
  return M.map((r) => r.map((v) => fmt(v)).join("\t")).join("\n");
}
 
grid("a");
grid("b");
 
document.querySelectorAll("[data-m]").forEach((b) => {
  b.onclick = () =>
    guard($("mout"), () => {
      const op = b.dataset.m;
      const A = read("a");
      if (op === "det") {
        if (A.length !== A[0].length) {
          throw new Error(
            "Dimensões incompatíveis: o determinante exige matriz quadrada"
          );
        }
        return "det(A) = " + fmt(det(A));
      }
      if (op === "kA") {
        const k = parseFloat($("ks").value.replace(",", "."));
        if (isNaN(k)) {
          throw new Error("Entrada inválida: k precisa ser um número");
        }
        return table(A.map((r) => r.map((v) => v * k)));
      }
 
      const B = read("b");
      if (op === "add" || op === "sub") {
        if (A.length !== B.length || A[0].length !== B[0].length) {
          throw new Error(
            "Dimensões incompatíveis: A e B precisam ter o mesmo tamanho"
          );
        }
        return table(
          A.map((r, i) =>
            r.map((v, j) => (op === "add" ? v + B[i][j] : v - B[i][j]))
          )
        );
      }
      if (A[0].length !== B.length) {
        throw new Error(
          "Dimensões incompatíveis: colunas de A devem ser iguais às linhas de B"
        );
      }
      return table(
        A.map((r) =>
          B[0].map((_, j) => r.reduce((soma, v, k) => soma + v * B[k][j], 0))
        )
      );
    });
});
function big(id, nome) {
  const v = $(id).value.trim();
  if (!/^\d+$/.test(v)) {
    throw new Error(`Entrada inválida: ${nome} deve ser inteiro não negativo`);
  }
  return BigInt(v);
}
 
function fat(n) {
  if (n > 3000n) throw new Error("n muito grande (máximo 3000)");
  let r = 1n;
  for (let i = 2n; i <= n; i++) r *= i;
  return r;
}
 
document.querySelectorAll("[data-c]").forEach((b) => {
  b.onclick = () =>
    guard($("cout"), () => {
      const tipo = b.dataset.c;
      if (tipo === "pR") {
        const raw = $("cr").value.trim();
        if (!raw) throw new Error("Entrada inválida: informe as repetições");
 
        let cnt;
        if (/^[\d,;\s]+$/.test(raw)) {
          cnt = raw.split(/[,;\s]+/).filter(Boolean).map(BigInt);
        } else {
          const letras = {};
          for (const ch of raw.replace(/\s/g, "").toUpperCase()) {
            letras[ch] = (letras[ch] || 0n) + 1n;
          }
          cnt = Object.values(letras);
        }
 
        const n = cnt.reduce((a, c) => a + c, 0n);
        let r = fat(n);
        for (const c of cnt) r /= fat(c);
 
        const denominador = cnt.map((c) => c + "!").join("·");
        return (
          `n = ${n}; multiplicidades = ${cnt.join(", ")}\n` +
          `${n}!/(${denominador}) = ${r}`
        );
      }
 
      const n = big("cn", "n");
 
      // Fatorial
      if (tipo === "fat") return `${n}! = ${fat(n)}`;
 
      const k = big("ck", "k");
      if (k > n) {
        throw new Error("Entrada inválida: k não pode ser maior que n");
      }
      if (tipo === "pS") {
        const arranjo = fat(n) / fat(n - k);
        return `P(${n}) = ${fat(n)}\nA(${n},${k}) = ${arranjo}`;
      }
      let r = 1n;
      const kk = k > n - k ? n - k : k;
      for (let i = 1n; i <= kk; i++) r = (r * (n - kk + i)) / i;
      return `C(${n},${k}) = ${r}`;
    });
});
$("bgo").onclick = () =>
  guard($("bout"), () => {
    const base = +$("bb").value;
    const v = $("bv").value.trim().toUpperCase();
    if (!v) throw new Error("Entrada inválida: digite um número");
 
    const neg = v[0] === "-";
    const digitos = neg ? v.slice(1) : v;
    if (!digitos) throw new Error("Entrada inválida");
    let n = 0n;
    for (const ch of digitos) {
      const x = parseInt(ch, 36);
      if (isNaN(x) || x >= base) {
        throw new Error(`Entrada inválida: "${ch}" não existe na base ${base}`);
      }
      n = n * BigInt(base) + BigInt(x);
    }
    if (neg) n = -n;
 
    const f = (b) => n.toString(b).toUpperCase();
    return (
      `Binário:     ${f(2)}\n` +
      `Octal:       ${f(8)}\n` +
      `Decimal:     ${f(10)}\n` +
      `Hexadecimal: ${f(16)}`
    );
  });