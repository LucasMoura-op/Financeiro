"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TransactionType = "income" | "expense";

type Transaction = {
  id: string;
  title: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
  fixed: boolean;
};

type FixedExpense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  dueDay: number;
  active: boolean;
};

type TransactionForm = {
  title: string;
  amount: string;
  category: string;
  type: TransactionType;
  date: string;
  fixed: boolean;
  dueDay: string;
};

type VaultPayload = {
  transactions: Transaction[];
  fixedExpenses: FixedExpense[];
};

type EncryptedVault = {
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  data: string;
};

type AuthSession = {
  username: string;
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
};

const transactionCategories = [
  "Salario",
  "Freelance",
  "Alimentacao",
  "Moradia",
  "Transporte",
  "Lazer",
  "Saude",
  "Educacao",
  "Investimentos",
  "Outros",
];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const today = new Date().toISOString().slice(0, 10);
const iterations = 210000;

const initialForm: TransactionForm = {
  title: "",
  amount: "",
  category: "Alimentacao",
  type: "expense",
  date: today,
  fixed: false,
  dueDay: "10",
};

function createId() {
  return crypto.randomUUID();
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${getMonthKey(date)}-02T12:00:00`));
}

function parseMoney(value: string) {
  return Number(value.replace(",", "."));
}

function buildDueDate(dueDay: number) {
  const date = new Date();
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(dueDay, 1), lastDay);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function getVaultStorageKey(username: string) {
  return `financeiro:vault:${normalizeUsername(username)}`;
}

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptVault(
  key: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  payload: VaultPayload,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encodedPayload,
  );

  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted) as Uint8Array<ArrayBuffer>),
  } satisfies EncryptedVault;
}

async function decryptVault(key: CryptoKey, vault: EncryptedVault) {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(vault.iv),
    },
    key,
    base64ToBytes(vault.data),
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as VaultPayload;
}

export default function Home() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "create">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [form, setForm] = useState<TransactionForm>(initialForm);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [month, setMonth] = useState(getMonthKey(today));

  useEffect(() => {
    localStorage.removeItem("financeiro:transactions");
    localStorage.removeItem("financeiro:fixed-expenses");
  }, []);

  useEffect(() => {
    if (!auth) {
      return;
    }

    void encryptVault(auth.key, auth.salt, { transactions, fixedExpenses }).then((vault) => {
      localStorage.setItem(getVaultStorageKey(auth.username), JSON.stringify(vault));
    });
  }, [auth, fixedExpenses, transactions]);

  const monthTransactions = useMemo(() => {
    return transactions.filter((transaction) => getMonthKey(transaction.date) === month);
  }, [month, transactions]);

  const visibleTransactions = useMemo(() => {
    return monthTransactions
      .filter((transaction) => filter === "all" || transaction.type === filter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filter, monthTransactions]);

  const totals = useMemo(() => {
    const income = monthTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((total, transaction) => total + transaction.amount, 0);

    const expenses = monthTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((total, transaction) => total + transaction.amount, 0);

    return {
      income,
      expenses,
      balance: income - expenses,
      fixed: fixedExpenses
        .filter((expense) => expense.active)
        .reduce((total, expense) => total + expense.amount, 0),
    };
  }, [fixedExpenses, monthTransactions]);

  const categoryTotals = useMemo(() => {
    return monthTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce<Record<string, number>>((acc, transaction) => {
        acc[transaction.category] = (acc[transaction.category] ?? 0) + transaction.amount;
        return acc;
      }, {});
  }, [monthTransactions]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");

    const username = normalizeUsername(authForm.username);
    const password = authForm.password;

    if (!username || password.length < 8) {
      setAuthMessage("Use um usuario e uma senha com pelo menos 8 caracteres.");
      return;
    }

    setAuthLoading(true);

    try {
      const storageKey = getVaultStorageKey(username);
      const savedVault = localStorage.getItem(storageKey);

      if (authMode === "create") {
        if (savedVault) {
          setAuthMessage("Esse usuario ja existe neste navegador.");
          return;
        }

        const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
        const key = await deriveKey(password, salt);
        const emptyVault = await encryptVault(key, salt, {
          transactions: [],
          fixedExpenses: [],
        });

        localStorage.setItem(storageKey, JSON.stringify(emptyVault));
        setTransactions([]);
        setFixedExpenses([]);
        setAuth({ username, key, salt });
        setAuthForm({ username, password: "" });
        return;
      }

      if (!savedVault) {
        setAuthMessage("Usuario nao encontrado neste navegador.");
        return;
      }

      const vault = JSON.parse(savedVault) as EncryptedVault;
      const salt = base64ToBytes(vault.salt);
      const key = await deriveKey(password, salt);
      const payload = await decryptVault(key, vault);

      setTransactions(payload.transactions);
      setFixedExpenses(payload.fixedExpenses);
      setAuth({ username, key, salt });
      setAuthForm({ username, password: "" });
    } catch {
      setAuthMessage("Nao foi possivel abrir o cofre. Confira usuario e senha.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    setAuth(null);
    setTransactions([]);
    setFixedExpenses([]);
    setForm(initialForm);
    setAuthMessage("");
  }

  function updateForm(field: keyof TransactionForm, value: string | boolean) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = parseMoney(form.amount);

    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const transaction: Transaction = {
      id: createId(),
      title: form.title.trim(),
      amount,
      category: form.category,
      type: form.type,
      date: form.date,
      fixed: form.fixed,
    };

    setTransactions((currentTransactions) => [transaction, ...currentTransactions]);

    if (form.fixed && form.type === "expense") {
      const dueDay = Number(form.dueDay);
      setFixedExpenses((currentFixedExpenses) => [
        {
          id: createId(),
          title: form.title.trim(),
          amount,
          category: form.category,
          dueDay: Number.isFinite(dueDay) ? dueDay : 10,
          active: true,
        },
        ...currentFixedExpenses,
      ]);
    }

    setForm(initialForm);
  }

  function applyFixedExpenses() {
    const activeFixedExpenses = fixedExpenses.filter((expense) => expense.active);
    const newTransactions = activeFixedExpenses.map<Transaction>((expense) => ({
      id: createId(),
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      type: "expense",
      date: buildDueDate(expense.dueDay),
      fixed: true,
    }));

    setTransactions((currentTransactions) => [...newTransactions, ...currentTransactions]);
  }

  function removeTransaction(id: string) {
    setTransactions((currentTransactions) =>
      currentTransactions.filter((transaction) => transaction.id !== id),
    );
  }

  function toggleFixedExpense(id: string) {
    setFixedExpenses((currentFixedExpenses) =>
      currentFixedExpenses.map((expense) =>
        expense.id === id ? { ...expense, active: !expense.active } : expense,
      ),
    );
  }

  function removeFixedExpense(id: string) {
    setFixedExpenses((currentFixedExpenses) =>
      currentFixedExpenses.filter((expense) => expense.id !== id),
    );
  }

  if (!auth) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef2f7] px-4 py-8 text-slate-950">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-300/50 lg:grid-cols-[1fr_420px]">
          <div className="bg-slate-950 p-6 text-white sm:p-8">
            <p className="text-sm font-semibold text-cyan-300">Cofre financeiro</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              Seus dados ficam criptografados antes de serem salvos.
            </h1>
            <div className="mt-8 grid gap-3 text-sm text-slate-300">
              <p>Senha derivada com PBKDF2-SHA256.</p>
              <p>Dados protegidos com AES-GCM de 256 bits.</p>
              <p>Sem a senha, o historico nao pode ser aberto.</p>
            </div>
          </div>

          <form className="grid gap-5 p-6 sm:p-8" onSubmit={handleAuthSubmit}>
            <div>
              <h2 className="text-2xl font-semibold">
                {authMode === "login" ? "Entrar" : "Criar acesso"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                O acesso vale para este navegador e este dispositivo.
              </p>
            </div>

            <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1">
              <button
                className={`h-10 rounded-md text-sm font-semibold transition ${
                  authMode === "login" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                }`}
                onClick={() => {
                  setAuthMode("login");
                  setAuthMessage("");
                }}
                type="button"
              >
                Login
              </button>
              <button
                className={`h-10 rounded-md text-sm font-semibold transition ${
                  authMode === "create" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                }`}
                onClick={() => {
                  setAuthMode("create");
                  setAuthMessage("");
                }}
                type="button"
              >
                Criar
              </button>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Usuario
              <input
                className="h-11 rounded-md border border-slate-200 px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) =>
                  setAuthForm((currentForm) => ({
                    ...currentForm,
                    username: event.target.value,
                  }))
                }
                placeholder="ex: lucas"
                value={authForm.username}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Senha
              <input
                className="h-11 rounded-md border border-slate-200 px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                minLength={8}
                onChange={(event) =>
                  setAuthForm((currentForm) => ({
                    ...currentForm,
                    password: event.target.value,
                  }))
                }
                placeholder="minimo 8 caracteres"
                type="password"
                value={authForm.password}
              />
            </label>

            {authMessage ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {authMessage}
              </p>
            ) : null}

            <button
              className="h-12 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={authLoading}
            >
              {authLoading ? "Abrindo cofre..." : authMode === "login" ? "Entrar" : "Criar cofre"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef2f7] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-lg bg-slate-950 text-white shadow-xl shadow-slate-300/40">
          <div className="grid gap-8 px-5 py-6 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-cyan-300">Financeiro pessoal</p>
                  <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
                    Organize receitas, despesas e contas fixas em um painel moderno.
                  </h1>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-200">
                  <span>{auth.username}</span>
                  <button
                    className="rounded bg-white/10 px-2 py-1 font-semibold text-white transition hover:bg-white/20"
                    onClick={logout}
                    type="button"
                  >
                    Sair
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <input
                  aria-label="Selecionar mes"
                  className="h-11 rounded-md border border-white/15 bg-white/10 px-4 text-sm text-white outline-none transition focus:border-cyan-300"
                  onChange={(event) => setMonth(event.target.value)}
                  type="month"
                  value={month}
                />
                <button
                  className="h-11 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                  onClick={applyFixedExpenses}
                  type="button"
                >
                  Aplicar fixas do mes
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/10 p-5">
              <p className="text-sm text-slate-300">Saldo de {getMonthLabel(`${month}-02`)}</p>
              <strong className="mt-3 block text-4xl font-semibold">
                {currency.format(totals.balance)}
              </strong>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-emerald-400/15 p-3">
                  <span className="text-emerald-200">Entradas</span>
                  <strong className="mt-1 block text-white">{currency.format(totals.income)}</strong>
                </div>
                <div className="rounded-md bg-rose-400/15 p-3">
                  <span className="text-rose-200">Saidas</span>
                  <strong className="mt-1 block text-white">{currency.format(totals.expenses)}</strong>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Receitas" tone="green" value={currency.format(totals.income)} />
          <SummaryCard label="Despesas" tone="red" value={currency.format(totals.expenses)} />
          <SummaryCard label="Fixas ativas" tone="blue" value={currency.format(totals.fixed)} />
          <SummaryCard label="Transacoes" tone="dark" value={String(monthTransactions.length)} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">Adicionar lancamento</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre entradas, saidas e despesas recorrentes.
              </p>
            </div>

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1">
                <button
                  className={`h-10 rounded-md text-sm font-semibold transition ${
                    form.type === "expense" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"
                  }`}
                  onClick={() => updateForm("type", "expense")}
                  type="button"
                >
                  Despesa
                </button>
                <button
                  className={`h-10 rounded-md text-sm font-semibold transition ${
                    form.type === "income" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"
                  }`}
                  onClick={() => updateForm("type", "income")}
                  type="button"
                >
                  Receita
                </button>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Descricao
                <input
                  className="h-11 rounded-md border border-slate-200 px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Ex: Aluguel, venda, mercado"
                  value={form.title}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Valor
                  <input
                    className="h-11 rounded-md border border-slate-200 px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    inputMode="decimal"
                    onChange={(event) => updateForm("amount", event.target.value)}
                    placeholder="0,00"
                    value={form.amount}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Data
                  <input
                    className="h-11 rounded-md border border-slate-200 px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    onChange={(event) => updateForm("date", event.target.value)}
                    type="date"
                    value={form.date}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Categoria
                <select
                  className="h-11 rounded-md border border-slate-200 bg-white px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => updateForm("category", event.target.value)}
                  value={form.category}
                >
                  {transactionCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-700">
                  Marcar como fixa
                  <input
                    checked={form.fixed}
                    className="h-5 w-5 accent-slate-950"
                    disabled={form.type === "income"}
                    onChange={(event) => updateForm("fixed", event.target.checked)}
                    type="checkbox"
                  />
                </label>

                {form.fixed && form.type === "expense" ? (
                  <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                    Dia de vencimento
                    <input
                      className="h-11 rounded-md border border-slate-200 px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      max="31"
                      min="1"
                      onChange={(event) => updateForm("dueDay", event.target.value)}
                      type="number"
                      value={form.dueDay}
                    />
                  </label>
                ) : null}
              </div>

              <button className="h-12 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800">
                Salvar lancamento
              </button>
            </form>
          </section>

          <section className="grid gap-6">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Historico</h2>
                  <p className="mt-1 text-sm text-slate-500">Movimentacoes do mes selecionado.</p>
                </div>

                <div className="grid grid-cols-3 rounded-md bg-slate-100 p-1 text-sm">
                  {[
                    ["all", "Todas"],
                    ["income", "Receitas"],
                    ["expense", "Despesas"],
                  ].map(([value, label]) => (
                    <button
                      className={`h-9 rounded-md px-3 font-semibold transition ${
                        filter === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                      }`}
                      key={value}
                      onClick={() => setFilter(value as "all" | TransactionType)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {visibleTransactions.length > 0 ? (
                  visibleTransactions.map((transaction) => (
                    <article
                      className="grid gap-3 p-5 sm:grid-cols-[1fr_160px_120px_36px] sm:items-center"
                      key={transaction.id}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{transaction.title}</h3>
                          {transaction.fixed ? (
                            <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-800">
                              fixa
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{transaction.category}</p>
                      </div>

                      <time className="text-sm text-slate-500">
                        {new Intl.DateTimeFormat("pt-BR").format(
                          new Date(`${transaction.date}T12:00:00`),
                        )}
                      </time>

                      <strong
                        className={`text-base sm:text-right ${
                          transaction.type === "income" ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {currency.format(transaction.amount)}
                      </strong>

                      <button
                        aria-label={`Remover ${transaction.title}`}
                        className="h-9 rounded-md border border-slate-200 text-sm font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => removeTransaction(transaction.id)}
                        type="button"
                      >
                        X
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Nenhuma transacao encontrada para este filtro.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold">Despesas fixas</h2>
                <div className="mt-4 grid gap-3">
                  {fixedExpenses.length > 0 ? (
                    fixedExpenses.map((expense) => (
                      <div
                        className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                        key={expense.id}
                      >
                        <div>
                          <h3 className="font-semibold">{expense.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Dia {expense.dueDay} | {expense.category} |{" "}
                            {currency.format(expense.amount)}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            className={`h-9 rounded-md px-3 text-sm font-semibold transition ${
                              expense.active
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                            onClick={() => toggleFixedExpense(expense.id)}
                            type="button"
                          >
                            {expense.active ? "Ativa" : "Pausada"}
                          </button>
                          <button
                            className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => removeFixedExpense(expense.id)}
                            type="button"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      Nenhuma despesa fixa cadastrada.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold">Categorias</h2>
                <div className="mt-4 grid gap-4">
                  {Object.entries(categoryTotals).length > 0 ? (
                    Object.entries(categoryTotals).map(([category, amount]) => {
                      const percentage = totals.expenses ? (amount / totals.expenses) * 100 : 0;

                      return (
                        <div key={category}>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="font-medium text-slate-700">{category}</span>
                            <span className="text-slate-500">{currency.format(amount)}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-cyan-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">Sem despesas neste mes.</p>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "green" | "red" | "blue" | "dark";
  value: string;
}) {
  const toneClass = {
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
    red: "border-rose-100 bg-rose-50 text-rose-800",
    blue: "border-cyan-100 bg-cyan-50 text-cyan-800",
    dark: "border-slate-200 bg-white text-slate-950",
  }[tone];

  return (
    <article className={`rounded-lg border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <strong className="mt-3 block text-2xl font-semibold">{value}</strong>
    </article>
  );
}
