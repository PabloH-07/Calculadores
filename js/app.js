
"use strict";




const byId = (id) => document.getElementById(id);

const formatNumber = (n) => String(parseFloat(n.toPrecision(12)));

/**
 * Exibe uma mensagem em um elemento, marcando-o (ou não) como erro.
 * @param {HTMLElement} element
 * @param {string} message
 * @param {boolean} [isError=false]
 */
function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

/**
 * Executa uma ação que devolve texto e exibe o resultado;
 * qualquer exceção é exibida como mensagem de erro.
 * @param {HTMLElement} element
 * @param {() => string} action
 */
function runGuarded(element, action) {
  try {
    showMessage(element, action());
  } catch (error) {
    showMessage(element, error.message, true);
  }
}




const TOKEN_PATTERN = new RegExp(
  "\\s*(" +
    "\\d+\\.?\\d*(?:e[+-]?\\d+)?|\\.\\d+(?:e[+-]?\\d+)?|" +
    "asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sqrt|cbrt|log2|log|ln|abs|exp|floor|ceil|round|" +
    "pi|e|x|[-+*/^()]" +
  ")",
  "y"
);

function throwDomainError() {
  throw new Error("Fora do domínio");
}

/** Elimina ruído de ponto flutuante: sin(π) = 1.2e-16 → 0. */
const snapToZero = (result, argument) =>
  Math.abs(result) < 1e-15 && Math.abs(argument) > 1e-6 ? 0 : result;

const MATH_FUNCTIONS = {
  sin: (v) => snapToZero(Math.sin(v), v),
  cos: (v) => snapToZero(Math.cos(v), v),
  tan: (v) => {
    if (Math.abs(Math.cos(v)) < 1e-15) {
      throwDomainError(); // tan(π/2) é indefinida
    }
    return snapToZero(Math.sin(v), v) / Math.cos(v);
  },
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  abs: Math.abs,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: (v) => Math.sign(v) * Math.round(Math.abs(v)),
};

/** Divide a expressão em tokens. */
function tokenize(source) {
  const tokens = [];
  let position = 0;

  while (position < source.length && source.slice(position).trim()) {
    TOKEN_PATTERN.lastIndex = position;
    const match = TOKEN_PATTERN.exec(source);
    if (!match) {
      throw new Error("Entrada inválida");
    }
    tokens.push(match[1]);
    position = TOKEN_PATTERN.lastIndex;
  }
  return tokens;
}

/**
 * Avalia uma expressão aritmética (descida recursiva).
 * Gramática: expr → term (('+'|'-') term)*; term → unary (('*'|'/'|implícita) unary)*;
 *            unary → ('-'|'+') unary | power; power → atom ('^' unary)?
 *
 * @param {string} source Expressão digitada.
 * @param {number} [x]    Valor da variável x, quando houver.
 * @returns {number}
 */
function evaluate(source, x) {
  const normalized = source
    .toLowerCase()
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/,/g, ".");

  const tokens = tokenize(normalized);
  let index = 0;

  const invalid = () => {
    throw new Error("Entrada inválida");
  };

  // ")" faltando no fim da expressão é fechado automaticamente.
  const closeParenthesis = () => {
    if (index < tokens.length && tokens[index++] !== ")") {
      invalid();
    }
  };

  const startsOperand = (token) =>
    token !== undefined && (/^[\d.a-z]/.test(token) || token === "(");

  function parseExpression() {
    let value = parseTerm();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parseUnary();

    for (;;) {
      const current = tokens[index];
      const previous = tokens[index - 1];

      if (current === "*" || current === "/") {
        index++;
        const right = parseUnary();
        if (current === "/") {
          if (right === 0) {
            throw new Error("Divisão por zero");
          }
          value /= right;
        } else {
          value *= right;
        }
      } else if (
   
        startsOperand(current) &&
        !(/^[\d.]/.test(current) && /^[\d.]/.test(previous))
      ) {
        value *= parsePower();
      } else {
        break;
      }
    }
    return value;
  }

  function parseUnary() {
    if (tokens[index] === "-") {
      index++;
      return -parseUnary();
    }
    if (tokens[index] === "+") {
      index++;
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower() {
    const base = parseAtom();
    if (tokens[index] === "^") {
      index++;
      return Math.pow(base, parseUnary());
    }
    return base;
  }

  function parseAtom() {
    const token = tokens[index++];

    if (token === undefined) {
      invalid();
    }
    if (/^[\d.]/.test(token)) {
      return parseFloat(token);
    }
    if (token === "(") {
      const value = parseExpression();
      closeParenthesis();
      return value;
    }
    if (token === "pi") {
      return Math.PI;
    }
    if (token === "e") {
      return Math.E;
    }
    if (token === "x") {
      if (x === undefined || isNaN(x)) {
        invalid();
      }
      return x;
    }
    if (Object.prototype.hasOwnProperty.call(MATH_FUNCTIONS, token)) {
      if (tokens[index++] !== "(") {
        invalid();
      }
      const argument = parseExpression();
      closeParenthesis();

      const outOfDomain =
        (token === "sqrt" && argument < 0) ||
        ((token === "ln" || token === "log" || token === "log2") && argument <= 0);
      if (outOfDomain) {
        throwDomainError();
      }

      const result = MATH_FUNCTIONS[token](argument);
      if (Number.isNaN(result)) {
        throwDomainError();
      }
      return result;
    }
    return invalid();
  }

  const result = parseExpression();
  if (index < tokens.length) {
    invalid();
  }
  if (!isFinite(result)) {
    throw new Error(
      isNaN(result) ? "Resultado indefinido (fora dos números reais)" : "Resultado fora do intervalo"
    );
  }
  return result;
}


function initTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((tab) => byId(tab.getAttribute("aria-controls")));

  const activate = (selected) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === selected));
      tab.tabIndex = i === selected ? 0 : -1;
      panels[i].hidden = i !== selected;
    });
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => activate(i));

    // Navegação por teclado entre abas (padrão WAI-ARIA)
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const target = {
        ArrowRight: i === last ? 0 : i + 1,
        ArrowLeft: i === 0 ? last : i - 1,
        Home: 0,
        End: last,
      }[event.key];

      if (target !== undefined) {
        event.preventDefault();
        activate(target);
        tabs[target].focus();
      }
    });
  });

  activate(0);
}




const BASIC_KEYS = [
  ["sin(", "sc"], ["cos(", "sc"], ["tan(", "sc"], ["√(", "sc"],
  ["ln(", "sc"], ["log(", "sc"], ["^", "sc"], ["π", "sc"],
  ["CE", "op"], ["C", "op"], ["⌫", "op"], ["÷", "op"],
  ["(", ""], [")", ""], ["±", "op"], ["×", "op"],
  ["7", ""], ["8", ""], ["9", ""], ["−", "op"],
  ["4", ""], ["5", ""], ["6", ""], ["+", "op"],
  ["1", ""], ["2", ""], ["3", ""], ["=", "eq"],
  ["0", ""], [".", ""], ["e", "sc"],
];

const KEYBOARD_MAP = {
  "*": "×",
  "/": "÷",
  "-": "−",
  ",": ".",
  Enter: "=",
  "=": "=",
  Backspace: "⌫",
  Escape: "C",
  Delete: "CE",
};

const basicState = {
  expression: "",
  finished: false, // true logo após "=": o próximo dígito inicia uma nova conta
};

function renderBasic(result, isError = false) {
  byId("bex").textContent = basicState.expression;
  if (result !== undefined) {
    showMessage(byId("brs"), result, isError);
  }
}

function pressKey(key) {
  const state = basicState;

  if (key === "=") {
    if (state.expression === "") {
      return;
    }
    try {
      const value = evaluate(state.expression);
      byId("bex").textContent = state.expression + " =";
      showMessage(byId("brs"), formatNumber(value));
      state.expression = String(parseFloat(value.toPrecision(15)));
      state.finished = true;
    } catch (error) {
      showMessage(byId("brs"), error.message, true);
    }
    return;
  }

  if (state.finished && key !== "±" && /^[\d.π(e]|^(sin|cos|tan|√|ln|log)/.test(key)) {
    state.expression = "";
  }
  state.finished = false;

  switch (key) {
    case "C":
      state.expression = "";
      renderBasic("0");
      return;

    case "CE":
      state.expression = state.expression.replace(/(\(-)?(\d+\.?\d*|\.\d+|[πe])\)?$/, "");
      renderBasic("0");
      return;

    case "⌫":
      state.expression = state.expression.replace(/(sin|cos|tan|ln|log)\($|√\($|.$/, "");
      renderBasic(state.expression || "0");
      return;

    case "±":
      toggleSign();
      renderBasic(state.expression);
      return;
  }

  if (key === "e" && /[\d.]$/.test(state.expression)) {
    state.expression += "×";
  }
  state.expression += key;
  renderBasic(state.expression);
}

/** Alterna o sinal do último número digitado: 5 ⇄ (-5). */
function toggleSign() {
  const negated = /\(-(\d+\.?\d*|\.\d+)\)$/;
  const number = /(\d+\.?\d*|\.\d+)$/;
  const state = basicState;

  if (negated.test(state.expression)) {
    state.expression = state.expression.replace(negated, "$1");
  } else if (number.test(state.expression)) {
    state.expression = state.expression.replace(number, "(-$1)");
  } else if (state.expression === "") {
    state.expression = "(-";
  }
}

function initBasic() {
  const pad = byId("bpad");

  BASIC_KEYS.forEach(([key, className]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = key;
    button.className = className;
    button.setAttribute("aria-label", key);
    button.addEventListener("click", () => pressKey(key));
    pad.append(button);
  });

  document.addEventListener("keydown", (event) => {
    if (byId("p-basica").hidden || /INPUT|SELECT/.test(event.target.tagName)) {
      return;
    }
    const key = KEYBOARD_MAP[event.key] || event.key;
    if (/^[\d.+()^]$/.test(key) || Object.values(KEYBOARD_MAP).includes(key)) {
      event.preventDefault();
      pressKey(key);
    }
  });
}


function initFunctions() {
  byId("fgo").addEventListener("click", () =>
    runGuarded(byId("fout"), () => {
      let x;
      try {
        x = evaluate(byId("xv").value.trim());
      } catch (error) {
        throw new Error("Entrada inválida: x precisa ser um número");
      }
      return `f(${formatNumber(x)}) = ${formatNumber(evaluate(byId("fx").value, x))}`;
    })
  );
}


const MATRIX_SIZES = { min: 1, max: 5, initial: 3 };

const MATRIX_SELECT_LABELS = {
  ar: "Linhas de A",
  ac: "Colunas de A",
  br: "Linhas de B",
  bc: "Colunas de B",
};


function readRawMatrix(name) {
  const grid = byId("g" + name).querySelector(".matrix-grid");
  if (!grid) {
    return [];
  }
  const rows = Number(grid.dataset.rows) || 0;
  const cols = Number(grid.dataset.cols) || 0;
  const inputs = grid.querySelectorAll("input");
  const values = [];

  for (let i = 0; i < rows; i++) {
    values[i] = [];
    for (let j = 0; j < cols; j++) {
      values[i][j] = inputs[i * cols + j].value;
    }
  }
  return values;
}

function buildMatrixGrid(name) {
  const rows = Number(byId(name + "r").value);
  const cols = Number(byId(name + "c").value);
  const previous = readRawMatrix(name);
  const container = byId("g" + name);

  const grid = document.createElement("div");
  grid.className = "matrix-grid";
  grid.style.gridTemplateColumns = `repeat(${cols}, auto)`;
  grid.dataset.rows = rows;
  grid.dataset.cols = cols;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "text";
      input.setAttribute("aria-label", `${name.toUpperCase()}[${i + 1},${j + 1}]`);
      input.value =
        previous[i] && previous[i][j] !== undefined ? previous[i][j] : i === j ? "1" : "0";
      grid.append(input);
    }
  }

  container.innerHTML = "";
  container.append(grid);
}

function readMatrix(name) {
  const rows = Number(byId(name + "r").value);
  const cols = Number(byId(name + "c").value);
  const inputs = byId("g" + name).querySelectorAll("input");
  const matrix = [];

  for (let i = 0; i < rows; i++) {
    matrix[i] = [];
    for (let j = 0; j < cols; j++) {
      const text = inputs[i * cols + j].value.trim();
      try {
        if (text === "") {
          throw new Error("vazio");
        }
        matrix[i][j] = evaluate(text);
      } catch (error) {
        throw new Error(`Entrada inválida em ${name.toUpperCase()}[${i + 1},${j + 1}]`);
      }
    }
  }
  return matrix;
}

function determinantExact(matrix) {
  const n = matrix.length;
  const a = matrix.map((row) => row.map((v) => BigInt(v)));
  let sign = 1n;
  let previousPivot = 1n;

  for (let k = 0; k < n - 1; k++) {
    if (a[k][k] === 0n) {
      let swap = -1;
      for (let i = k + 1; i < n; i++) {
        if (a[i][k] !== 0n) {
          swap = i;
          break;
        }
      }
      if (swap < 0) {
        return 0n;
      }
      [a[k], a[swap]] = [a[swap], a[k]];
      sign = -sign;
    }
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j < n; j++) {
        a[i][j] = (a[i][j] * a[k][k] - a[i][k] * a[k][j]) / previousPivot;
      }
    }
    previousPivot = a[k][k];
  }
  return sign * a[n - 1][n - 1];
}


function determinantFloat(matrix) {
  const n = matrix.length;
  const a = matrix.map((row) => row.slice());
  let exponent = 0;

  const log2Clamped = (m) => Math.max(-1000, Math.min(1000, Math.round(Math.log2(m))));

  for (let i = 0; i < n; i++) {
    const max = Math.max(...a[i].map(Math.abs));
    if (max === 0) {
      return 0;
    }
    const k = log2Clamped(max);
    exponent += k;
    a[i] = a[i].map((v) => v * Math.pow(2, -k));
  }

  for (let j = 0; j < n; j++) {
    const max = Math.max(...a.map((row) => Math.abs(row[j])));
    if (max === 0) {
      return 0;
    }
    const k = log2Clamped(max);
    exponent += k;
    a.forEach((row) => {
      row[j] *= Math.pow(2, -k);
    });
  }

  let det = 1;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) {
        pivot = r;
      }
    }
    if (Math.abs(a[pivot][c]) <= 1e-12) {
      return 0; // matriz equilibrada (maior entrada ≈ 1): limite absoluto
    }
    if (pivot !== c) {
      [a[pivot], a[c]] = [a[c], a[pivot]];
      det = -det;
    }
    det *= a[c][c];
    for (let r = c + 1; r < n; r++) {
      const factor = a[r][c] / a[c][c];
      for (let k = c; k < n; k++) {
        a[r][k] -= factor * a[c][k];
      }
    }
  }

  const half = Math.trunc(exponent / 2);
  return det * Math.pow(2, half) * Math.pow(2, exponent - half);
}

function determinant(matrix) {
  const allSafeIntegers = matrix.every((row) =>
    row.every((v) => Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER)
  );
  const value = allSafeIntegers ? Number(determinantExact(matrix)) : determinantFloat(matrix);

  if (!isFinite(value)) {
    throw new Error("Resultado fora do intervalo");
  }
  return value;
}

const matrixToText = (matrix) =>
  matrix.map((row) => row.map((v) => formatNumber(v)).join("\t")).join("\n");

function applyMatrixOperation(operation) {
  const a = readMatrix("a");

  if (operation === "det") {
    if (a.length !== a[0].length) {
      throw new Error("Dimensões incompatíveis: o determinante exige matriz quadrada");
    }
    return "det(A) = " + formatNumber(determinant(a));
  }

  if (operation === "kA") {
    let k;
    try {
      k = evaluate(byId("ks").value.trim());
    } catch (error) {
      throw new Error("Entrada inválida: k precisa ser um número");
    }
    return matrixToText(a.map((row) => row.map((v) => v * k)));
  }

  const b = readMatrix("b");

  if (operation === "add" || operation === "sub") {
    if (a.length !== b.length || a[0].length !== b[0].length) {
      throw new Error("Dimensões incompatíveis: A e B precisam ter o mesmo tamanho");
    }
    return matrixToText(
      a.map((row, i) => row.map((v, j) => (operation === "add" ? v + b[i][j] : v - b[i][j])))
    );
  }

  // Multiplicação A × B
  if (a[0].length !== b.length) {
    throw new Error("Dimensões incompatíveis: colunas de A devem ser iguais às linhas de B");
  }
  return matrixToText(
    a.map((row) => b[0].map((_, j) => row.reduce((sum, v, k) => sum + v * b[k][j], 0)))
  );
}

function initMatrices() {
  Object.entries(MATRIX_SELECT_LABELS).forEach(([id, label]) => {
    const select = byId(id);
    const isRows = id[1] === "r";

    select.setAttribute("aria-label", label);
    for (let n = MATRIX_SIZES.min; n <= MATRIX_SIZES.max; n++) {
      select.add(new Option((isRows ? "Linhas " : "Colunas ") + n, n));
    }
    select.value = MATRIX_SIZES.initial;
    select.addEventListener("change", () => buildMatrixGrid(id[0]));
  });

  buildMatrixGrid("a");
  buildMatrixGrid("b");

  document.querySelectorAll("[data-m]").forEach((button) => {
    button.addEventListener("click", () =>
      runGuarded(byId("mout"), () => applyMatrixOperation(button.dataset.m))
    );
  });
}

const FACTORIAL_LIMIT = 3000n;
const COMBINATION_LIMIT = 100000n;

/** Lê um inteiro não negativo de um campo de entrada. */
function readBigInt(id, label) {
  const text = byId(id).value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`Entrada inválida: ${label} deve ser inteiro não negativo`);
  }
  return BigInt(text);
}

function factorial(n) {
  if (n > FACTORIAL_LIMIT) {
    throw new Error(`n muito grande (máximo ${FACTORIAL_LIMIT})`);
  }
  let result = 1n;
  for (let i = 2n; i <= n; i++) {
    result *= i;
  }
  return result;
}

function parseMultiplicities(raw) {
  if (/^[\d,;\s]+$/.test(raw)) {
    return raw.split(/[,;\s]+/).filter(Boolean).map(BigInt);
  }

  const items = /[,;]/.test(raw)
    ? raw.split(/[,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [...raw.replace(/\s/g, "").toUpperCase()];

  const counts = {};
  for (const item of items) {
    counts[item] = (counts[item] || 0n) + 1n;
  }
  return Object.values(counts);
}

function permutationWithRepetition() {
  const raw = byId("cr").value.trim();
  if (!raw) {
    throw new Error("Entrada inválida: informe as repetições");
  }

  const counts = parseMultiplicities(raw);
  const n = counts.reduce((sum, c) => sum + c, 0n);
  let result = factorial(n);
  for (const c of counts) {
    result /= factorial(c);
  }
  const denominator = counts.map((c) => c + "!").join("·");

  return `n = ${n}; multiplicidades = ${counts.join(", ")}\n${n}!/(${denominator}) = ${result}`;
}

function combination(n, k) {
  const smaller = k > n - k ? n - k : k;
  if (smaller > COMBINATION_LIMIT) {
    throw new Error(
      `k muito grande: o máximo é ${COMBINATION_LIMIT} (já considerando C(n,k) = C(n,n−k))`
    );
  }
  let result = 1n;
  for (let i = 1n; i <= smaller; i++) {
    result = (result * (n - smaller + i)) / i;
  }
  return result;
}

function applyCombinatorics(kind) {
  if (kind === "pR") {
    return permutationWithRepetition();
  }

  const n = readBigInt("cn", "n");
  if (kind === "fat") {
    return `${n}! = ${factorial(n)}`;
  }

  const k = readBigInt("ck", "k");
  if (k > n) {
    throw new Error("Entrada inválida: k não pode ser maior que n");
  }

  if (kind === "pS") {
    const arrangements = factorial(n) / factorial(n - k);
    return `P(${n}) = ${factorial(n)}\nA(${n},${k}) = ${arrangements}`;
  }
  return `C(${n},${k}) = ${combination(n, k)}`;
}

function initCombinatorics() {
  document.querySelectorAll("[data-c]").forEach((button) => {
    button.addEventListener("click", () =>
      runGuarded(byId("cout"), () => applyCombinatorics(button.dataset.c))
    );
  });
}


const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE_NAMES = { 2: "Binário", 8: "Octal", 10: "Decimal", 16: "Hexadecimal" };
const BASE_PREFIXES = { 2: "0B", 8: "0O", 16: "0X" };
const FRACTION_DIGITS = 24;

function describeInvalidDigit(char, digit, base) {
  const hint = `Na base ${base} use só 0 a ${DIGITS[base - 1]}.`;

  if (digit < 0) {
    return `Entrada inválida: "${char}" não é um dígito. ${hint}`;
  }
  if (digit < 10) {
    return `Entrada inválida: o dígito "${char}" não existe na base ${base}. ${hint}`;
  }
  return `Entrada inválida: o dígito "${char}" vale ${digit} e só existe a partir da base ${digit + 1}. ${hint}`;
}

/**
 * Converte o texto digitado em uma fração exata num/den (BigInt).
 * @returns {{negative: boolean, numerator: bigint, denominator: bigint}}
 */
function parseInBase(text, base) {
  let value = text
    .trim()
    .toUpperCase()
    .replace(/[−–—]/g, "-")
    .replace(/[\s_]/g, "")
    .replace(",", ".");

  if (!value) {
    throw new Error("Entrada inválida: digite um número");
  }

  let negative = false;
  if (value[0] === "-" || value[0] === "+") {
    negative = value[0] === "-";
    value = value.slice(1);
  }

  const prefix = BASE_PREFIXES[base];
  if (prefix && value.startsWith(prefix) && value.length > 2) {
    value = value.slice(2);
  }

  const parts = value.split(".");
  if (parts.length > 2) {
    throw new Error("Entrada inválida: mais de um ponto decimal");
  }

  const integerPart = parts[0];
  const fractionPart = parts[1] || "";
  if (!integerPart && !fractionPart) {
    throw new Error("Entrada inválida: digite um número");
  }

  const bigBase = BigInt(base);
  let numerator = 0n;
  for (const char of integerPart + fractionPart) {
    const digit = DIGITS.indexOf(char);
    if (digit < 0 || digit >= base) {
      throw new Error(describeInvalidDigit(char, digit, base));
    }
    numerator = numerator * bigBase + BigInt(digit);
  }

  return { negative, numerator, denominator: bigBase ** BigInt(fractionPart.length) };
}

/** Converte a fração num/den para a base indicada (até 24 dígitos fracionários). */
function formatInBase(numerator, denominator, base) {
  let text = (numerator / denominator).toString(base).toUpperCase();
  let remainder = numerator % denominator;

  if (remainder !== 0n) {
    const bigBase = BigInt(base);
    text += ".";
    for (let k = 0; remainder !== 0n && k < FRACTION_DIGITS; k++) {
      remainder *= bigBase;
      text += DIGITS[Number(remainder / denominator)];
      remainder %= denominator;
    }
  }
  return { text, exact: remainder === 0n };
}

function convertBases() {
  const inputBase = Number(byId("bb").value);
  const extraBase = Number(byId("bt").value);
  const { negative, numerator, denominator } = parseInBase(byId("bv").value, inputBase);

  const sign = negative && numerator !== 0n ? "-" : "";
  let approximated = false;

  const line = (label, base) => {
    const { text, exact } = formatInBase(numerator, denominator, base);
    if (!exact) {
      approximated = true;
    }
    return (label + ":").padEnd(18) + sign + text + (exact ? "" : " …");
  };

  const lines = [
    line("Binário (2)", 2),
    line("Octal (8)", 8),
    line("Decimal (10)", 10),
    line("Hexadecimal (16)", 16),
  ];
  if (![2, 8, 10, 16].includes(extraBase)) {
    lines.push(line(`Base ${extraBase}`, extraBase));
  }
  if (approximated) {
    lines.push(
      `\n… = aproximação (${FRACTION_DIGITS} dígitos fracionários); a fração é periódica nessa base.`
    );
  }
  return lines.join("\n");
}

function initBases() {
  ["bb", "bt"].forEach((id) => {
    const select = byId(id);
    for (let base = 2; base <= 36; base++) {
      const name = BASE_NAMES[base] ? " – " + BASE_NAMES[base] : "";
      select.add(new Option(base + name, base));
    }
  });
  byId("bb").value = 10;
  byId("bt").value = 3;

  byId("bgo").addEventListener("click", () => runGuarded(byId("bout"), convertBases));
}

const MAX_BOOLEAN_VARIABLES = 6;

/** Mapa de símbolos aceitos → operador canônico. */
const CANONICAL_OPERATORS = {
  ".": "AND", "&": "AND", "∧": "AND", "*": "AND", "·": "AND", AND: "AND",
  "|": "OR", "∨": "OR", "+": "OR", OR: "OR",
  "!": "NOT", "~": "NOT", "¬": "NOT", NOT: "NOT",
  "^": "XOR", "⊕": "XOR", XOR: "XOR",
  "->": "IMP", "=>": "IMP", "→": "IMP",
  "<->": "IFF", "<=>": "IFF", "↔": "IFF",
  NAND: "NAND", NOR: "NOR", XNOR: "XNOR",
};

const BOOLEAN_TOKEN_PATTERN =
  /\s*(XNOR|NAND|AND|NOR|XOR|NOT|OR|<->|<=>|->|=>|[A-Z01]|[.&|!~^+*·∧∨¬⊕↔→'()])/y;

const BOOLEAN_BUTTONS = [
  ["·", "E"], ["+", "OU"], ["¬", "NÃO"], ["⊕", "XOR"], ["→", "implica"], ["↔", "equivale"],
  ["(", ""], [")", ""], [" NAND ", "NAND"], [" NOR ", "NOR"], [" XNOR ", "XNOR"],
];

/**
 * Converte a expressão em árvore sintática (AST).
 * Precedência: NÃO > E > XOR > OU > → > ↔.
 * @returns {{ast: object, vars: string[]}}
 */
function parseBoolean(source) {
  const text = source
    .toUpperCase()
    .replace(/[’′‘´`]/g, "'")
    .replace(/[∙⋅•×]/g, "·")
    .replace(/⊻/g, "⊕")
    .replace(/⇒/g, "→")
    .replace(/[⇔≡]/g, "↔");

  if (!text.trim()) {
    throw new Error("Digite uma expressão");
  }

  const tokens = [];
  let position = 0;
  while (position < text.length && text.slice(position).trim()) {
    BOOLEAN_TOKEN_PATTERN.lastIndex = position;
    const match = BOOLEAN_TOKEN_PATTERN.exec(text);
    if (!match) {
      throw new Error(`Expressão inválida perto de "${text.slice(position).trim().charAt(0)}"`);
    }
    tokens.push(CANONICAL_OPERATORS[match[1]] || match[1]);
    position = BOOLEAN_TOKEN_PATTERN.lastIndex;
  }

  let index = 0;
  const variables = new Set();
  const invalid = () => {
    throw new Error("Expressão inválida");
  };
  const isOperand = (token) => token !== undefined && /^[A-Z01]$/.test(token);

  function parseIff() {
    let left = parseImplication();
    while (tokens[index] === "IFF") {
      index++;
      left = { op: "IFF", a: left, b: parseImplication() };
    }
    return left;
  }

  function parseImplication() {
    const left = parseOr();
    if (tokens[index] === "IMP") {
      index++;
      return { op: "IMP", a: left, b: parseImplication() }; // associativa à direita
    }
    return left;
  }

  function parseOr() {
    let left = parseXor();
    while (tokens[index] === "OR" || tokens[index] === "NOR") {
      const op = tokens[index++];
      left = { op, a: left, b: parseXor() };
    }
    return left;
  }

  function parseXor() {
    let left = parseAnd();
    while (tokens[index] === "XOR" || tokens[index] === "XNOR") {
      const op = tokens[index++];
      left = { op, a: left, b: parseAnd() };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    for (;;) {
      if (tokens[index] === "AND" || tokens[index] === "NAND") {
        const op = tokens[index++];
        left = { op, a: left, b: parseNot() };
      } else if (isOperand(tokens[index]) || tokens[index] === "(" || tokens[index] === "NOT") {
        left = { op: "AND", a: left, b: parseNot() }; // justaposição: AB
      } else {
        break;
      }
    }
    return left;
  }

  function parseNot() {
    if (tokens[index] === "NOT") {
      index++;
      return { op: "NOT", a: parseNot() };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let node = parseAtom();
    while (tokens[index] === "'") {
      index++;
      node = { op: "NOT", a: node };
    }
    return node;
  }

  function parseAtom() {
    const token = tokens[index++];

    if (token === undefined) {
      invalid();
    }
    if (token === "(") {
      const value = parseIff();
      if (tokens[index++] !== ")") {
        invalid();
      }
      return value;
    }
    if (token === "0" || token === "1") {
      return { op: "CONST", value: token === "1" };
    }
    if (/^[A-Z]$/.test(token)) {
      variables.add(token);
      return { op: "VAR", name: token };
    }
    return invalid();
  }

  const ast = parseIff();
  if (index < tokens.length) {
    invalid();
  }
  return { ast, vars: [...variables].sort() };
}

/** Avalia a árvore para um ambiente {variável: booleano}. */
function evaluateBoolean(node, env) {
  switch (node.op) {
    case "CONST": return node.value;
    case "VAR": return env[node.name];
    case "NOT": return !evaluateBoolean(node.a, env);
  }

  const a = evaluateBoolean(node.a, env);
  const b = evaluateBoolean(node.b, env);

  switch (node.op) {
    case "AND": return a && b;
    case "OR": return a || b;
    case "XOR": return a !== b;
    case "NAND": return !(a && b);
    case "NOR": return !(a || b);
    case "XNOR": return a === b;
    case "IMP": return !a || b;
    case "IFF": return a === b;
  }
}

/**
 * Quine-McCluskey com cobertura de custo mínimo (menos termos; depois menos literais),
 * resolvida por busca com poda. Casos patológicos devolvem a melhor cobertura achada
 * e são sinalizados em `result.approx`.
 *
 * @param {number[]} minterms Índices das linhas da tabela-verdade.
 * @param {number} n          Número de variáveis.
 * @returns {string[]} Implicantes no formato "01-0" (hífen = variável ausente).
 */
function quineMcCluskey(minterms, n) {
  if (!minterms.length) {
    return [];
  }
  if (n === 0) {
    return [""];
  }

  const toBinary = (m) => m.toString(2).padStart(n, "0");

  // --- Fase 1: geração dos implicantes primos ---
  let current = new Set(minterms.map(toBinary));
  const primes = [];

  while (current.size) {
    const items = [...current];
    const used = new Set();
    const next = new Set();

    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        let diffAt = -1;
        let combinable = true;

        for (let k = 0; k < n; k++) {
          if (items[a][k] !== items[b][k]) {
            if (items[a][k] === "-" || items[b][k] === "-" || diffAt >= 0) {
              combinable = false;
              break;
            }
            diffAt = k;
          }
        }
        if (combinable && diffAt >= 0) {
          next.add(items[a].slice(0, diffAt) + "-" + items[a].slice(diffAt + 1));
          used.add(items[a]);
          used.add(items[b]);
        }
      }
    }

    items.forEach((item) => {
      if (!used.has(item)) {
        primes.push(item);
      }
    });
    current = next;
  }

  // --- Fase 2: tabela de cobertura ---
  const covers = (prime, minterm) => {
    const bits = toBinary(minterm);
    for (let k = 0; k < n; k++) {
      if (prime[k] !== "-" && prime[k] !== bits[k]) {
        return false;
      }
    }
    return true;
  };
  const literalCount = (prime) => [...prime].filter((c) => c !== "-").length;

  // Mintermos (índices) cobertos por cada primo
  const coveredBy = primes.map(
    (p) => new Set(minterms.map((m, i) => (covers(p, m) ? i : -1)).filter((i) => i >= 0))
  );
  // Primos que cobrem cada mintermo
  const optionsFor = minterms.map((_, i) =>
    primes.map((_, j) => j).filter((j) => coveredBy[j].has(i))
  );

  let best = null;
  let bestCost = Infinity;
  let nodes = 0;
  const NODE_LIMIT = 20000;

  const cost = (j) => 1000 + literalCount(primes[j]);

  /** Limite inferior: mintermos sem primo em comum precisam de termos distintos. */
  const independentCount = (left, options) => {
    const blocked = new Set();
    let count = 0;
    for (const m of left.slice().sort((a, b) => options[a].length - options[b].length)) {
      if (options[m].some((j) => blocked.has(j))) {
        continue;
      }
      count++;
      options[m].forEach((j) => blocked.add(j));
    }
    return count;
  };

  function solve(left, candidates, selected, literals) {
    let options;

    // Reduz a tabela de cobertura até não mudar mais
    for (;;) {
      if (!left.length) {
        const total = selected.length * 1000 + literals;
        if (total < bestCost) {
          bestCost = total;
          best = selected.slice();
        }
        return;
      }
      if (++nodes > NODE_LIMIT) {
        return;
      }

      const candidateSet = new Set(candidates);
      options = {};
      for (const m of left) {
        options[m] = optionsFor[m].filter((j) => candidateSet.has(j));
        if (!options[m].length) {
          return;
        }
      }

      // Primo essencial
      const essential = left.find((m) => options[m].length === 1);
      if (essential !== undefined) {
        const j = options[essential][0];
        selected = selected.concat(j);
        literals += literalCount(primes[j]);
        left = left.filter((m) => !coveredBy[j].has(m));
        candidates = candidates.filter((k) => k !== j);
        continue;
      }

      // Dominância de linhas: se "a" é coberto por um subconjunto dos primos de "b", descarta "b"
      let dropRow = null;
      rows: for (const a of left) {
        for (const b of left) {
          if (a === b) {
            continue;
          }
          const oa = options[a];
          const ob = options[b];
          if (
            oa.length <= ob.length &&
            oa.every((j) => ob.includes(j)) &&
            (oa.length < ob.length || a < b)
          ) {
            dropRow = b;
            break rows;
          }
        }
      }
      if (dropRow !== null) {
        left = left.filter((m) => m !== dropRow);
        continue;
      }

      // Dominância de colunas: "k" cobre tudo que "j" cobre, por custo ≤
      let dropColumn = null;
      cols: for (const j of candidates) {
        const coveredByJ = left.filter((m) => coveredBy[j].has(m));
        for (const k of candidates) {
          if (k === j || cost(k) > cost(j) || !coveredByJ.every((m) => coveredBy[k].has(m))) {
            continue;
          }
          // Empate exato: remove só o de maior índice
          if (
            cost(k) === cost(j) &&
            k > j &&
            left.every((m) => coveredBy[k].has(m) === coveredBy[j].has(m))
          ) {
            continue;
          }
          dropColumn = j;
          break cols;
        }
      }
      if (dropColumn !== null) {
        candidates = candidates.filter((k) => k !== dropColumn);
        continue;
      }
      break;
    }

    if ((selected.length + independentCount(left, options)) * 1000 + literals >= bestCost) {
      return;
    }

    // Ramifica no mintermo com menos opções
    let pick = left[0];
    for (const m of left) {
      if (options[m].length < options[pick].length) {
        pick = m;
      }
    }
    const ordered = options[pick]
      .slice()
      .sort(
        (x, y) =>
          left.filter((m) => coveredBy[y].has(m)).length -
          left.filter((m) => coveredBy[x].has(m)).length
      );
    const j = ordered[0];
    const rest = candidates.filter((k) => k !== j);

    solve(left.filter((m) => !coveredBy[j].has(m)), rest, selected.concat(j), literals + literalCount(primes[j])); // com j
    solve(left, rest, selected, literals); // sem j
  }

  solve(
    minterms.map((_, i) => i),
    primes.map((_, j) => j),
    [],
    0
  );

  const result = best
    .map((j) => primes[j])
    .sort((a, b) => minterms.find((m) => covers(a, m)) - minterms.find((m) => covers(b, m)));
  result.approx = nodes > NODE_LIMIT;
  return result;
}

/** Cria uma célula/elemento com texto, evitando innerHTML. */
function createElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
}

/** Monta a tabela-verdade (F e, opcionalmente, G). */
function buildTruthTable(vars, f, g) {
  const n = vars.length;
  const hasSecond = g.length > 0;
  const table = document.createElement("table");
  table.className = "truth-table";

  const headerRow = table.createTHead().insertRow();
  [...vars, "F", ...(hasSecond ? ["G"] : [])].forEach((title) => {
    headerRow.append(createElement("th", title));
  });

  const body = table.createTBody();
  for (let row = 0; row < f.length; row++) {
    const tr = body.insertRow();
    vars.forEach((_, j) => {
      tr.insertCell().textContent = (row >> (n - 1 - j)) & 1;
    });
    [f[row], ...(hasSecond ? [g[row]] : [])].forEach((value) => {
      const cell = tr.insertCell();
      cell.textContent = value;
      if (value) {
        cell.className = "one";
      }
    });
  }

  const wrapper = document.createElement("div");
  wrapper.className = "table-wrap";
  wrapper.append(table);
  return wrapper;
}

function analyzeBoolean() {
  const output = byId("boout");

  try {
    const first = parseBoolean(byId("be").value);
    const secondText = byId("be2").value.trim();
    const second = secondText ? parseBoolean(secondText) : null;

    const vars = second ? [...new Set([...first.vars, ...second.vars])].sort() : first.vars;
    if (vars.length > MAX_BOOLEAN_VARIABLES) {
      throw new Error(`Máximo de ${MAX_BOOLEAN_VARIABLES} variáveis (você usou ${vars.length})`);
    }

    const n = vars.length;
    const rowCount = 1 << n;
    const f = [];
    const g = [];

    const environmentFor = (row) => {
      const env = {};
      vars.forEach((v, j) => {
        env[v] = Boolean((row >> (n - 1 - j)) & 1);
      });
      return env;
    };

    for (let row = 0; row < rowCount; row++) {
      const env = environmentFor(row);
      f.push(Number(evaluateBoolean(first.ast, env)));
      if (second) {
        g.push(Number(evaluateBoolean(second.ast, env)));
      }
    }

    const indicesOf = (values, target) =>
      values.map((v, row) => (v === target ? row : -1)).filter((row) => row >= 0);
    const ones = indicesOf(f, 1);
    const zeros = indicesOf(f, 0);

    /** Literais de um implicante; `positive` define se 0 → variável negada (SOP) ou o contrário (POS). */
    const literalsOf = (pattern, positive) => {
      const literals = [];
      for (let k = 0; k < n; k++) {
        if (pattern[k] === "-") {
          continue;
        }
        const negated = (pattern[k] === "0") === positive;
        literals.push(vars[k] + (negated ? "'" : ""));
      }
      return literals;
    };

    const sumOfProducts = (implicants) =>
      implicants.length
        ? implicants
            .map((p) => {
              const literals = literalsOf(p, true);
              return literals.length ? literals.join("·") : "1";
            })
            .join(" + ")
        : "0";

    const productOfSums = (implicants) => {
      if (!implicants.length) {
        return "1";
      }
      const factors = implicants.map((p) => {
        const literals = literalsOf(p, false);
        if (literals.length === 0) {
          return "0";
        }
        return literals.length === 1 ? literals[0] : "(" + literals.join(" + ") + ")";
      });
      return factors.includes("0") ? "0" : factors.join("·");
    };

    const sopResult = quineMcCluskey(ones, n);
    const posResult = quineMcCluskey(zeros, n);
    const formLabel = (result, kind) =>
      result.approx
        ? `Forma reduzida (${kind}; pode não ser a mínima)`
        : `Forma mínima (${kind})`;

    const classification =
      ones.length === rowCount ? "tautologia" : ones.length === 0 ? "contradição" : "contingência";

    const lines = [
      `Variáveis: ${vars.join(", ") || "(nenhuma)"} — ${rowCount} linha${rowCount > 1 ? "s" : ""}`,
      `Classificação: ${classification}`,
      `Σ m(${ones.join(", ")})`,
      `Π M(${zeros.join(", ")})`,
      `${formLabel(sopResult, "soma de produtos")}: ${sumOfProducts(sopResult)}`,
      `${formLabel(posResult, "produto de somas")}: ${productOfSums(posResult)}`,
    ];

    if (second) {
      const equivalent = f.every((v, row) => v === g[row]);
      const differences = indicesOf(
        f.map((v, row) => Number(v !== g[row])),
        1
      );
      lines.push(
        "Equivalência: " +
          (equivalent
            ? "as duas expressões são equivalentes."
            : `as expressões NÃO são equivalentes (diferem nas linhas ${differences.join(", ")}).`)
      );
    }

    output.textContent = "";
    output.classList.remove("is-error");
    lines.forEach((text) => output.append(createElement("span", text, "line")));
    output.append(buildTruthTable(vars, f, g));
    if (second) {
      output.append(createElement("span", "F = 1ª expressão, G = 2ª expressão.", "line caption"));
    }
  } catch (error) {
    showMessage(output, error.message, true);
  }
}

function initBoolean() {
  const group = byId("bops");
  const input = byId("be");

  BOOLEAN_BUTTONS.forEach(([symbol, name]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "alt";
    button.textContent = symbol.trim();
    button.setAttribute("aria-label", "Inserir " + (name || symbol));
    button.addEventListener("click", () => {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      input.setRangeText(symbol, start, end, "end");
      input.focus();
    });
    group.append(button);
  });

  byId("bogo").addEventListener("click", analyzeBoolean);
}



initTabs();
initBasic();
initFunctions();
initMatrices();
initCombinatorics();
initBases();
initBoolean();