"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type BusinessType = "airbnb" | "events" | "auction";

type Scenario = {
  id: string;
  name: string;
  type: BusinessType;
  city: string;
  acquisitionCost: number;
  acquisitionFees: number;
  setupCost: number;
  workingCapital: number;
  monthlyFixedCost: number;
  monthlyDebtService: number;
  variableCostRate: number;
  averageTicket: number;
  monthlyDemand: number;
  occupancyRate: number;
  expectedAppreciationRate: number;
  notes: string;
  createdAt: string;
};

type ScenarioForm = {
  name: string;
  type: BusinessType;
  city: string;
  acquisitionCost: string;
  acquisitionFees: string;
  setupCost: string;
  workingCapital: string;
  monthlyFixedCost: string;
  monthlyDebtService: string;
  variableCostRate: string;
  averageTicket: string;
  monthlyDemand: string;
  occupancyRate: string;
  expectedAppreciationRate: string;
  notes: string;
};

type ScenarioMetrics = {
  grossRevenue: number;
  variableCost: number;
  operatingProfit: number;
  netProfit: number;
  totalInvestment: number;
  annualProfit: number;
  projectedAnnualGain: number;
  capRate: number;
  investorReturn: number;
  paybackMonths: number | null;
  margin: number;
  breakEvenDemand: number;
  score: number;
  risk: "Baixo" | "Moderado" | "Alto";
};

type SyncStatus = "local" | "loading" | "saving" | "synced" | "error";

const storageKey = "aureon:business-scenarios";
const legacyStorageKey = "negociosx:scenarios";
const workspaceStorageKey = "aureon:workspace-key";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const cloudSyncEnabled = Boolean(supabaseUrl && supabaseAnonKey);

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const businessLabels: Record<BusinessType, string> = {
  airbnb: "Studio Airbnb",
  events: "Local de eventos",
  auction: "Imovel de leilao",
};

const businessHints: Record<BusinessType, string> = {
  airbnb: "Analise diaria, ocupacao, taxas da plataforma, condominio, limpeza e capital para mobiliario.",
  events: "Analise agenda mensal, ticket por evento, equipe, manutencao, licencas e sazonalidade.",
  auction: "Analise desagio, ITBI/cartorio, regularizacao, reforma, risco juridico e potencial de valorizacao.",
};

const defaultsByType: Record<BusinessType, Omit<ScenarioForm, "type" | "name" | "city" | "notes">> = {
  airbnb: {
    acquisitionCost: "280000",
    acquisitionFees: "18000",
    setupCost: "45000",
    workingCapital: "18000",
    monthlyFixedCost: "2800",
    monthlyDebtService: "0",
    variableCostRate: "18",
    averageTicket: "320",
    monthlyDemand: "24",
    occupancyRate: "72",
    expectedAppreciationRate: "6",
  },
  events: {
    acquisitionCost: "420000",
    acquisitionFees: "26000",
    setupCost: "85000",
    workingCapital: "35000",
    monthlyFixedCost: "9500",
    monthlyDebtService: "0",
    variableCostRate: "28",
    averageTicket: "6500",
    monthlyDemand: "6",
    occupancyRate: "65",
    expectedAppreciationRate: "5",
  },
  auction: {
    acquisitionCost: "210000",
    acquisitionFees: "23000",
    setupCost: "70000",
    workingCapital: "30000",
    monthlyFixedCost: "1800",
    monthlyDebtService: "0",
    variableCostRate: "12",
    averageTicket: "2800",
    monthlyDemand: "4",
    occupancyRate: "85",
    expectedAppreciationRate: "12",
  },
};

const initialForm: ScenarioForm = {
  name: "",
  type: "airbnb",
  city: "",
  notes: "",
  ...defaultsByType.airbnb,
};

const seedScenarios: Scenario[] = [
  {
    id: "seed-airbnb",
    name: "Studio compacto perto do metro",
    type: "airbnb",
    city: "Sao Paulo, SP",
    acquisitionCost: 280000,
    acquisitionFees: 18000,
    setupCost: 45000,
    workingCapital: 18000,
    monthlyFixedCost: 2800,
    monthlyDebtService: 0,
    variableCostRate: 18,
    averageTicket: 320,
    monthlyDemand: 24,
    occupancyRate: 72,
    expectedAppreciationRate: 6,
    notes: "Bom para testar diaria, ocupacao e custo de mobilia.",
    createdAt: new Date("2026-05-19T12:00:00").toISOString(),
  },
  {
    id: "seed-events",
    name: "Chacara para eventos pequenos",
    type: "events",
    city: "Campinas, SP",
    acquisitionCost: 420000,
    acquisitionFees: 26000,
    setupCost: 85000,
    workingCapital: 35000,
    monthlyFixedCost: 9500,
    monthlyDebtService: 0,
    variableCostRate: 28,
    averageTicket: 6500,
    monthlyDemand: 6,
    occupancyRate: 65,
    expectedAppreciationRate: 5,
    notes: "Depende de calendario, vizinhanca e licencas.",
    createdAt: new Date("2026-05-19T12:10:00").toISOString(),
  },
  {
    id: "seed-auction",
    name: "Apartamento de leilao para reforma",
    type: "auction",
    city: "Santos, SP",
    acquisitionCost: 210000,
    acquisitionFees: 23000,
    setupCost: 70000,
    workingCapital: 30000,
    monthlyFixedCost: 1800,
    monthlyDebtService: 0,
    variableCostRate: 12,
    averageTicket: 2800,
    monthlyDemand: 4,
    occupancyRate: 85,
    expectedAppreciationRate: 12,
    notes: "Considerar documentacao, desocupacao e reserva juridica.",
    createdAt: new Date("2026-05-19T12:20:00").toISOString(),
  },
];

function createId() {
  return crypto.randomUUID();
}

function toNumber(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calculateMetrics(scenario: Scenario): ScenarioMetrics {
  const effectiveDemand = scenario.monthlyDemand * (clamp(scenario.occupancyRate, 0, 100) / 100);
  const grossRevenue = effectiveDemand * scenario.averageTicket;
  const variableCost = grossRevenue * (clamp(scenario.variableCostRate, 0, 100) / 100);
  const operatingProfit = grossRevenue - variableCost - scenario.monthlyFixedCost;
  const netProfit = operatingProfit - scenario.monthlyDebtService;
  const totalInvestment =
    scenario.acquisitionCost + scenario.acquisitionFees + scenario.setupCost + scenario.workingCapital;
  const annualProfit = netProfit * 12;
  const projectedAnnualGain =
    annualProfit + totalInvestment * (clamp(scenario.expectedAppreciationRate, -100, 100) / 100);
  const capRate = totalInvestment > 0 ? annualProfit / totalInvestment : 0;
  const investorReturn = totalInvestment > 0 ? projectedAnnualGain / totalInvestment : 0;
  const paybackMonths = netProfit > 0 && totalInvestment > 0 ? totalInvestment / netProfit : null;
  const margin = grossRevenue > 0 ? netProfit / grossRevenue : 0;
  const contribution = scenario.averageTicket * (1 - clamp(scenario.variableCostRate, 0, 100) / 100);
  const breakEvenDemand =
    contribution > 0 ? (scenario.monthlyFixedCost + scenario.monthlyDebtService) / contribution : 0;

  const score = Math.round(
    clamp(investorReturn * 240 + margin * 40 - (paybackMonths ?? 120) * 0.3 + 45, 0, 100),
  );

  return {
    grossRevenue,
    variableCost,
    operatingProfit,
    netProfit,
    totalInvestment,
    annualProfit,
    projectedAnnualGain,
    capRate,
    investorReturn,
    paybackMonths,
    margin,
    breakEvenDemand,
    score,
    risk: score >= 72 ? "Baixo" : score >= 48 ? "Moderado" : "Alto",
  };
}

function scenarioFromForm(form: ScenarioForm): Scenario {
  return {
    id: createId(),
    name: form.name.trim(),
    type: form.type,
    city: form.city.trim(),
    acquisitionCost: toNumber(form.acquisitionCost),
    acquisitionFees: toNumber(form.acquisitionFees),
    setupCost: toNumber(form.setupCost),
    workingCapital: toNumber(form.workingCapital),
    monthlyFixedCost: toNumber(form.monthlyFixedCost),
    monthlyDebtService: toNumber(form.monthlyDebtService),
    variableCostRate: clamp(toNumber(form.variableCostRate), 0, 100),
    averageTicket: toNumber(form.averageTicket),
    monthlyDemand: toNumber(form.monthlyDemand),
    occupancyRate: clamp(toNumber(form.occupancyRate), 0, 100),
    expectedAppreciationRate: clamp(toNumber(form.expectedAppreciationRate), -100, 100),
    notes: form.notes.trim(),
    createdAt: new Date().toISOString(),
  };
}

function formFromScenario(scenario: Scenario): ScenarioForm {
  return {
    name: scenario.name,
    type: scenario.type,
    city: scenario.city,
    acquisitionCost: String(scenario.acquisitionCost),
    acquisitionFees: String(scenario.acquisitionFees),
    setupCost: String(scenario.setupCost),
    workingCapital: String(scenario.workingCapital),
    monthlyFixedCost: String(scenario.monthlyFixedCost),
    monthlyDebtService: String(scenario.monthlyDebtService),
    variableCostRate: String(scenario.variableCostRate),
    averageTicket: String(scenario.averageTicket),
    monthlyDemand: String(scenario.monthlyDemand),
    occupancyRate: String(scenario.occupancyRate),
    expectedAppreciationRate: String(scenario.expectedAppreciationRate),
    notes: scenario.notes,
  };
}

function normalizeStoredScenario(value: unknown): Scenario | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const scenario = value as Record<string, unknown>;

  const hasRequiredFields =
    typeof scenario.id === "string" &&
    typeof scenario.name === "string" &&
    (scenario.type === "airbnb" || scenario.type === "events" || scenario.type === "auction") &&
    typeof scenario.city === "string" &&
    typeof scenario.acquisitionCost === "number" &&
    typeof scenario.setupCost === "number" &&
    typeof scenario.monthlyFixedCost === "number" &&
    typeof scenario.variableCostRate === "number" &&
    typeof scenario.averageTicket === "number" &&
    typeof scenario.monthlyDemand === "number" &&
    typeof scenario.occupancyRate === "number" &&
    typeof scenario.notes === "string" &&
    typeof scenario.createdAt === "string";

  if (!hasRequiredFields) {
    return null;
  }

  return {
    id: scenario.id as string,
    name: scenario.name as string,
    type: scenario.type as BusinessType,
    city: scenario.city as string,
    acquisitionCost: scenario.acquisitionCost as number,
    acquisitionFees: typeof scenario.acquisitionFees === "number" ? scenario.acquisitionFees : 0,
    setupCost: scenario.setupCost as number,
    workingCapital: typeof scenario.workingCapital === "number" ? scenario.workingCapital : 0,
    monthlyFixedCost: scenario.monthlyFixedCost as number,
    monthlyDebtService: typeof scenario.monthlyDebtService === "number" ? scenario.monthlyDebtService : 0,
    variableCostRate: scenario.variableCostRate as number,
    averageTicket: scenario.averageTicket as number,
    monthlyDemand: scenario.monthlyDemand as number,
    occupancyRate: scenario.occupancyRate as number,
    expectedAppreciationRate:
      typeof scenario.expectedAppreciationRate === "number" ? scenario.expectedAppreciationRate : 0,
    notes: scenario.notes as string,
    createdAt: scenario.createdAt as string,
  };
}

function parseScenariosSnapshot(snapshot: string | null) {
  if (!snapshot) {
    return seedScenarios;
  }

  try {
    const parsed = JSON.parse(snapshot) as unknown;

    if (!Array.isArray(parsed)) {
      return seedScenarios;
    }

    return parsed
      .map(normalizeStoredScenario)
      .filter((scenario): scenario is Scenario => Boolean(scenario));
  } catch {
    return seedScenarios;
  }
}

function normalizeWorkspaceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function getStoredWorkspaceKey() {
  if (typeof window === "undefined") {
    return "aureon";
  }

  return normalizeWorkspaceKey(localStorage.getItem(workspaceStorageKey) ?? "aureon") || "aureon";
}

function readStoredScenarios() {
  if (typeof window === "undefined") {
    return seedScenarios;
  }

  try {
    return parseScenariosSnapshot(localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey));
  } catch {
    return seedScenarios;
  }
}

function saveScenarios(nextScenarios: Scenario[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextScenarios));
  } catch {
    // The app remains usable even if browser storage is blocked.
  }
}

async function fetchCloudScenarios(workspaceKey: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/aureon_workspaces?workspace_key=eq.${encodeURIComponent(
      workspaceKey,
    )}&select=payload`,
    {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar os dados do Supabase.");
  }

  const rows = (await response.json()) as Array<{ payload: unknown }>;
  const payload = rows[0]?.payload;

  if (!payload) {
    return null;
  }

  return parseScenariosSnapshot(JSON.stringify(payload));
}

async function saveCloudScenarios(workspaceKey: string, nextScenarios: Scenario[]) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/aureon_workspaces?on_conflict=workspace_key`,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        workspace_key: workspaceKey,
        payload: nextScenarios,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Nao foi possivel salvar os dados no Supabase.");
  }
}

export default function Home() {
  const [scenarios, setScenarioState] = useState<Scenario[]>(seedScenarios);
  const [storageReady, setStorageReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [workspaceKey, setWorkspaceKey] = useState("aureon");
  const [workspaceInput, setWorkspaceInput] = useState("aureon");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncMessage, setSyncMessage] = useState("Dados salvos apenas neste navegador.");
  const [form, setForm] = useState<ScenarioForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"all" | BusinessType>("all");

  const loadCloudWorkspace = useCallback(
    async (nextWorkspaceKey: string, fallbackScenarios: Scenario[]) => {
      const normalizedKey = normalizeWorkspaceKey(nextWorkspaceKey);

      if (!normalizedKey) {
        setSyncStatus("error");
        setSyncMessage("Informe um codigo de grupo valido.");
        return;
      }

      setWorkspaceKey(normalizedKey);
      setWorkspaceInput(normalizedKey);
      setCloudReady(false);

      if (typeof window !== "undefined") {
        localStorage.setItem(workspaceStorageKey, normalizedKey);
      }

      if (!cloudSyncEnabled) {
        setSyncStatus("local");
        setSyncMessage("Supabase ainda nao configurado. Os dados estao somente neste navegador.");
        return;
      }

      setSyncStatus("loading");
      setSyncMessage("Carregando dados da nuvem...");

      try {
        const cloudScenarios = await fetchCloudScenarios(normalizedKey);

        if (cloudScenarios) {
          setScenarioState(cloudScenarios);
          setSyncStatus("synced");
          setSyncMessage(`Sincronizado na nuvem: ${normalizedKey}`);
        } else {
          await saveCloudScenarios(normalizedKey, fallbackScenarios);
          setScenarioState(fallbackScenarios);
          setSyncStatus("synced");
          setSyncMessage(`Novo grupo criado na nuvem: ${normalizedKey}`);
        }

        setCloudReady(true);
      } catch {
        setSyncStatus("error");
        setSyncMessage("Nao foi possivel conectar ao Supabase. Verifique URL, anon key e tabela.");
      }
    },
    [],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const storedWorkspaceKey = getStoredWorkspaceKey();
      const localScenarios = readStoredScenarios();

      setWorkspaceKey(storedWorkspaceKey);
      setWorkspaceInput(storedWorkspaceKey);
      setScenarioState(localScenarios);
      setStorageReady(true);

      if (cloudSyncEnabled) {
        void loadCloudWorkspace(storedWorkspaceKey, localScenarios);
      }
    });
  }, [loadCloudWorkspace]);

  useEffect(() => {
    if (storageReady) {
      saveScenarios(scenarios);
    }
  }, [scenarios, storageReady]);

  useEffect(() => {
    if (!storageReady || !cloudReady || !cloudSyncEnabled) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSyncStatus("saving");
      setSyncMessage("Salvando na nuvem...");

      void saveCloudScenarios(workspaceKey, scenarios)
        .then(() => {
          setSyncStatus("synced");
          setSyncMessage(`Sincronizado na nuvem: ${workspaceKey}`);
        })
        .catch(() => {
          setSyncStatus("error");
          setSyncMessage("Nao foi possivel salvar na nuvem. Verifique Supabase e RLS.");
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [cloudReady, scenarios, storageReady, workspaceKey]);

  function setScenarios(updater: Scenario[] | ((currentScenarios: Scenario[]) => Scenario[])) {
    setScenarioState((currentScenarios) => {
      const nextScenarios =
        typeof updater === "function" ? updater(currentScenarios) : updater;

      return nextScenarios;
    });
  }

  function handleWorkspaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadCloudWorkspace(workspaceInput, scenarios);
  }

  const previewScenario = useMemo(() => {
    const scenario = scenarioFromForm({
      ...form,
      name: form.name || "Nova oportunidade",
      city: form.city || "Mercado em analise",
    });

    return scenario;
  }, [form]);

  const previewMetrics = useMemo(() => calculateMetrics(previewScenario), [previewScenario]);

  const rankedScenarios = useMemo(() => {
    return scenarios
      .filter((scenario) => selectedType === "all" || scenario.type === selectedType)
      .map((scenario) => ({ scenario, metrics: calculateMetrics(scenario) }))
      .sort((a, b) => b.metrics.score - a.metrics.score);
  }, [scenarios, selectedType]);

  const portfolio = useMemo(() => {
    const metrics = scenarios.map(calculateMetrics);
    const totalInvestment = metrics.reduce((total, item) => total + item.totalInvestment, 0);
    const monthlyProfit = metrics.reduce((total, item) => total + item.netProfit, 0);
    const grossRevenue = metrics.reduce((total, item) => total + item.grossRevenue, 0);
    const best = rankedScenarios[0];

    return {
      totalInvestment,
      monthlyProfit,
      grossRevenue,
      annualProfit: monthlyProfit * 12,
      capRate: totalInvestment > 0 ? (monthlyProfit * 12) / totalInvestment : 0,
      best,
    };
  }, [rankedScenarios, scenarios]);

  function updateForm(field: keyof ScenarioForm, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function updateType(type: BusinessType) {
    setForm((currentForm) => ({
      ...currentForm,
      type,
      ...defaultsByType[type],
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const submittedForm: ScenarioForm = {
      ...form,
      name: String(data.get("name") ?? form.name),
      city: String(data.get("city") ?? form.city),
      acquisitionCost: String(data.get("acquisitionCost") ?? form.acquisitionCost),
      acquisitionFees: String(data.get("acquisitionFees") ?? form.acquisitionFees),
      setupCost: String(data.get("setupCost") ?? form.setupCost),
      workingCapital: String(data.get("workingCapital") ?? form.workingCapital),
      monthlyFixedCost: String(data.get("monthlyFixedCost") ?? form.monthlyFixedCost),
      monthlyDebtService: String(data.get("monthlyDebtService") ?? form.monthlyDebtService),
      variableCostRate: String(data.get("variableCostRate") ?? form.variableCostRate),
      averageTicket: String(data.get("averageTicket") ?? form.averageTicket),
      monthlyDemand: String(data.get("monthlyDemand") ?? form.monthlyDemand),
      occupancyRate: String(data.get("occupancyRate") ?? form.occupancyRate),
      expectedAppreciationRate: String(
        data.get("expectedAppreciationRate") ?? form.expectedAppreciationRate,
      ),
      notes: String(data.get("notes") ?? form.notes),
    };

    const scenario = scenarioFromForm(submittedForm);
    if (!scenario.name || !scenario.city || scenario.averageTicket <= 0) {
      return;
    }

    if (editingId) {
      setScenarios((currentScenarios) =>
        currentScenarios.map((currentScenario) =>
          currentScenario.id === editingId
            ? { ...scenario, id: editingId, createdAt: currentScenario.createdAt }
            : currentScenario,
        ),
      );
    } else {
      setScenarios((currentScenarios) => [scenario, ...currentScenarios]);
    }

    resetForm();
  }

  function editScenario(scenario: Scenario) {
    setEditingId(scenario.id);
    setForm(formFromScenario(scenario));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeScenario(id: string) {
    setScenarios((currentScenarios) => currentScenarios.filter((scenario) => scenario.id !== id));
    if (editingId === id) {
      resetForm();
    }
  }

  function duplicateScenario(scenario: Scenario) {
    setScenarios((currentScenarios) => [
      {
        ...scenario,
        id: createId(),
        name: `${scenario.name} - copia`,
        createdAt: new Date().toISOString(),
      },
      ...currentScenarios,
    ]);
  }

  function exportScenarios() {
    const blob = new Blob([JSON.stringify(scenarios, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `aureon-cenarios-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function restoreExamples() {
    setScenarios(seedScenarios);
    resetForm();
    setSelectedType("all");
  }

  function clearScenarios() {
    setScenarios([]);
    resetForm();
    setSelectedType("all");
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="grid gap-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:grid-cols-[1.1fr_0.9fr] xl:p-6">
          <div className="flex min-w-0 flex-col justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-cyan-700">
                Grupo Aureon | Lucas Moura
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                Aureon Business Desk
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Painel executivo para estudar aquisicoes, operacoes e retornos de negocios
                imobiliarios antes de colocar capital em risco.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Capital analisado" value={currency.format(portfolio.totalInvestment)} />
              <MetricTile label="Caixa livre mensal" value={currency.format(portfolio.monthlyProfit)} />
              <MetricTile label="Retorno op." value={percent.format(portfolio.capRate)} />
            </div>
          </div>

          <section className="rounded-lg bg-slate-950 p-5 text-white">
            <p className="text-sm text-slate-300">Parecer preliminar Aureon</p>
            {portfolio.best ? (
              <>
                <h2 className="mt-3 text-2xl font-semibold">{portfolio.best.scenario.name}</h2>
                <p className="mt-1 text-sm text-slate-300">
                  {businessLabels[portfolio.best.scenario.type]} em {portfolio.best.scenario.city}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <DarkTile label="Score" value={`${portfolio.best.metrics.score}/100`} />
                  <DarkTile label="Risco" value={portfolio.best.metrics.risk} />
                  <DarkTile label="Caixa livre" value={currency.format(portfolio.best.metrics.netProfit)} />
                  <DarkTile
                    label="Payback"
                    value={
                      portfolio.best.metrics.paybackMonths
                        ? `${portfolio.best.metrics.paybackMonths.toFixed(1)} meses`
                        : "Inviavel"
                    }
                  />
                  <DarkTile
                    label="Margem"
                    value={percent.format(portfolio.best.metrics.margin)}
                  />
                  <DarkTile
                    label="Equilibrio"
                    value={`${portfolio.best.metrics.breakEvenDemand.toFixed(1)} vendas`}
                  />
                  <DarkTile
                    label="Ret. total"
                    value={percent.format(portfolio.best.metrics.investorReturn)}
                  />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-300">
                Cadastre uma oportunidade para iniciar a analise do Grupo Aureon.
              </p>
            )}
          </section>
        </header>

        <section className="grid gap-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cyan-700">Nuvem Aureon</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Sincronizacao entre dispositivos
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use o mesmo codigo do grupo no computador, celular ou tablet para acessar os
              mesmos estudos. Sem Supabase configurado, o app continua salvando apenas neste
              navegador.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[220px_auto]" onSubmit={handleWorkspaceSubmit}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Codigo do grupo
              <input
                className="h-11 rounded-md border border-slate-200 px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setWorkspaceInput(event.target.value)}
                placeholder="aureon"
                value={workspaceInput}
              />
            </label>
            <button
              className="h-11 self-end rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={syncStatus === "loading" || syncStatus === "saving"}
              type="submit"
            >
              Conectar
            </button>
          </form>

          <div className="lg:col-span-2">
            <SyncNotice
              configured={cloudSyncEnabled}
              message={syncMessage}
              status={syncStatus}
            />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">
                {editingId ? "Editar estudo" : "Novo estudo de investimento"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Informe premissas contabeis, operacionais e financeiras para gerar um parecer rapido.
              </p>
            </div>

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-3 rounded-md bg-slate-100 p-1">
                {(Object.keys(businessLabels) as BusinessType[]).map((type) => (
                  <button
                    className={`min-h-10 rounded-md px-2 text-xs font-semibold transition sm:text-sm ${
                      form.type === type ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                    }`}
                    key={type}
                    onClick={() => updateType(type)}
                    type="button"
                  >
                    {type === "airbnb" ? "Airbnb" : type === "events" ? "Eventos" : "Leilao"}
                  </button>
                ))}
              </div>

              <p className="rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
                {businessHints[form.type]}
              </p>

              <TextInput
                label="Nome do projeto ou ativo"
                name="name"
                onChange={(value) => updateForm("name", value)}
                placeholder="Ex: Studio Vila Mariana, Espaco Aureon Eventos"
                required
                value={form.name}
              />

              <TextInput
                label="Cidade e estado"
                name="city"
                onChange={(value) => updateForm("city", value)}
                placeholder="Ex: Sao Paulo, SP"
                required
                value={form.city}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  inputMode="decimal"
                  label="Preco de compra"
                  name="acquisitionCost"
                  onChange={(value) => updateForm("acquisitionCost", value)}
                  value={form.acquisitionCost}
                />
                <TextInput
                  inputMode="decimal"
                  label="ITBI, cartorio e taxas"
                  name="acquisitionFees"
                  onChange={(value) => updateForm("acquisitionFees", value)}
                  value={form.acquisitionFees}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  inputMode="decimal"
                  label="Reforma, mobilia e setup"
                  name="setupCost"
                  onChange={(value) => updateForm("setupCost", value)}
                  value={form.setupCost}
                />
                <TextInput
                  inputMode="decimal"
                  label="Capital de giro/reserva"
                  name="workingCapital"
                  onChange={(value) => updateForm("workingCapital", value)}
                  value={form.workingCapital}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  inputMode="decimal"
                  label="Custos fixos mensais"
                  name="monthlyFixedCost"
                  onChange={(value) => updateForm("monthlyFixedCost", value)}
                  value={form.monthlyFixedCost}
                />
                <TextInput
                  inputMode="decimal"
                  label="Parcela/financiamento mensal"
                  name="monthlyDebtService"
                  onChange={(value) => updateForm("monthlyDebtService", value)}
                  value={form.monthlyDebtService}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  inputMode="decimal"
                  label="Impostos, taxas e comissoes %"
                  max="100"
                  min="0"
                  name="variableCostRate"
                  onChange={(value) => updateForm("variableCostRate", value)}
                  type="number"
                  value={form.variableCostRate}
                />
                <TextInput
                  inputMode="decimal"
                  label="Valorizacao anual esperada %"
                  max="100"
                  min="-100"
                  name="expectedAppreciationRate"
                  onChange={(value) => updateForm("expectedAppreciationRate", value)}
                  type="number"
                  value={form.expectedAppreciationRate}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  inputMode="decimal"
                  label={form.type === "airbnb" ? "Diaria media" : "Receita media por venda"}
                  name="averageTicket"
                  onChange={(value) => updateForm("averageTicket", value)}
                  value={form.averageTicket}
                />
                <TextInput
                  inputMode="decimal"
                  label={form.type === "airbnb" ? "Diarias disponiveis no mes" : "Vendas/eventos por mes"}
                  name="monthlyDemand"
                  onChange={(value) => updateForm("monthlyDemand", value)}
                  value={form.monthlyDemand}
                />
              </div>

              <TextInput
                inputMode="decimal"
                label="Ocupacao, agenda ou conversao %"
                max="100"
                min="0"
                name="occupancyRate"
                onChange={(value) => updateForm("occupancyRate", value)}
                type="number"
                value={form.occupancyRate}
              />

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Observacoes
                <textarea
                  className="min-h-24 rounded-md border border-slate-200 px-3 py-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  name="notes"
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Riscos juridicos, licencas, impostos, reforma, concorrencia, liquidez, documentacao..."
                  value={form.notes}
                />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <PreviewMetric label="Receita bruta" value={currency.format(previewMetrics.grossRevenue)} />
                  <PreviewMetric label="Caixa livre" value={currency.format(previewMetrics.netProfit)} />
                  <PreviewMetric label="Ret. total" value={percent.format(previewMetrics.investorReturn)} />
                  <PreviewMetric
                    label="Payback"
                    value={
                      previewMetrics.paybackMonths
                        ? `${previewMetrics.paybackMonths.toFixed(1)}m`
                        : "Inviavel"
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  className="h-12 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={(event) => event.currentTarget.form?.requestSubmit()}
                  type="button"
                >
                  {editingId ? "Salvar parecer" : "Salvar estudo"}
                </button>
                {editingId ? (
                  <button
                    className="h-12 rounded-md border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    onClick={resetForm}
                    type="button"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="grid gap-5">
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Comite de oportunidades Aureon</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Ordenado por retorno total, margem, payback e risco operacional.
                  </p>
                </div>
                <div className="grid w-full gap-3 xl:max-w-3xl xl:grid-cols-[1fr_auto]">
                  <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1 text-sm sm:grid-cols-4">
                    {(["all", "airbnb", "events", "auction"] as const).map((type) => (
                      <button
                        className={`h-9 rounded-md px-2 font-semibold transition ${
                          selectedType === type
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500"
                        }`}
                        key={type}
                        onClick={() => setSelectedType(type)}
                        type="button"
                      >
                        {type === "all"
                          ? "Todos"
                          : type === "airbnb"
                            ? "Airbnb"
                            : type === "events"
                              ? "Eventos"
                              : "Leilao"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      onClick={exportScenarios}
                      type="button"
                    >
                      Exportar
                    </button>
                    <button
                      className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      onClick={restoreExamples}
                      type="button"
                    >
                      Exemplos
                    </button>
                    <button
                      className="h-10 rounded-md border border-rose-100 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      onClick={clearScenarios}
                      type="button"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {rankedScenarios.length > 0 ? (
                  rankedScenarios.map(({ scenario, metrics }, index) => (
                    <article
                      className="grid gap-4 rounded-lg border border-slate-200 p-4 lg:grid-cols-[52px_minmax(0,1fr)] xl:grid-cols-[52px_minmax(0,1fr)_minmax(300px,440px)] xl:items-center"
                      key={scenario.id}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-lg font-semibold text-slate-700">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{scenario.name}</h3>
                          <span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
                            {businessLabels[scenario.type]}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              metrics.risk === "Baixo"
                                ? "bg-emerald-50 text-emerald-800"
                                : metrics.risk === "Moderado"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-rose-50 text-rose-800"
                            }`}
                          >
                            Risco {metrics.risk}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{scenario.city}</p>
                        {scenario.notes ? (
                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{scenario.notes}</p>
                        ) : null}
                      </div>

                      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:col-start-2 xl:col-start-auto xl:grid-cols-2">
                        <ResultMetric label="Score" value={`${metrics.score}/100`} />
                        <ResultMetric label="Caixa livre" value={currency.format(metrics.netProfit)} />
                        <ResultMetric label="Retorno op." value={percent.format(metrics.capRate)} />
                        <ResultMetric
                          label="Payback"
                          value={metrics.paybackMonths ? `${metrics.paybackMonths.toFixed(1)}m` : "Inviavel"}
                        />
                        <ResultMetric label="Margem" value={percent.format(metrics.margin)} />
                        <ResultMetric label="Ret. total" value={percent.format(metrics.investorReturn)} />
                      </div>

                      <div className="flex flex-wrap gap-2 md:col-start-2 md:col-end-4 md:justify-end">
                        <button
                          className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                          onClick={() => editScenario(scenario)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                          onClick={() => duplicateScenario(scenario)}
                          type="button"
                        >
                          Duplicar
                        </button>
                        <button
                          className="h-9 rounded-md border border-rose-100 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                          onClick={() => removeScenario(scenario.id)}
                          type="button"
                        >
                          Remover
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Nenhum estudo encontrado para este filtro.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <InsightCard
                label="Receita bruta mensal"
                text="Demanda efetiva multiplicada pela receita media de cada venda, diaria ou evento."
                value={currency.format(portfolio.grossRevenue)}
              />
              <InsightCard
                label="Caixa livre anual"
                text="Receita menos impostos, taxas, custos fixos e parcelas, anualizada para decisao."
                value={currency.format(portfolio.annualProfit)}
              />
              <InsightCard
                label="Ponto de equilibrio"
                text="Demanda media necessaria para cobrir custos fixos e servico da divida."
                value={
                  scenarios.length > 0
                    ? `${(
                        scenarios
                          .map(calculateMetrics)
                          .reduce((total, item) => total + item.breakEvenDemand, 0) /
                        scenarios.length
                      ).toFixed(1)} vendas`
                    : "0 vendas"
                }
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function TextInput({
  label,
  name,
  onChange,
  value,
  inputMode,
  max,
  min,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  name: keyof ScenarioForm;
  onChange: (value: string) => void;
  value: string;
  inputMode?: "decimal" | "numeric" | "text";
  max?: string;
  min?: string;
  placeholder?: string;
  required?: boolean;
  type?: "number" | "text";
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <input
        className="h-11 rounded-md border border-slate-200 px-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
        inputMode={inputMode}
        max={max}
        min={min}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function SyncNotice({
  configured,
  message,
  status,
}: {
  configured: boolean;
  message: string;
  status: SyncStatus;
}) {
  const toneClass = {
    local: "border-amber-200 bg-amber-50 text-amber-900",
    loading: "border-cyan-200 bg-cyan-50 text-cyan-900",
    saving: "border-cyan-200 bg-cyan-50 text-cyan-900",
    synced: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
  }[status];

  return (
    <div className={`rounded-md border px-3 py-2 text-sm leading-6 ${toneClass}`}>
      <strong className="font-semibold">
        {configured ? "Status da nuvem: " : "Nuvem nao configurada: "}
      </strong>
      {configured
        ? message
        : "adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel para salvar em todos os dispositivos."}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <strong className="mt-2 block break-words text-lg font-semibold leading-tight text-slate-950 sm:text-xl">
        {value}
      </strong>
    </div>
  );
}

function DarkTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white/10 p-3">
      <p className="text-xs text-slate-300">{label}</p>
      <strong className="mt-1 block break-words text-sm font-semibold leading-tight text-white sm:text-base">
        {value}
      </strong>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <strong className="mt-1 block break-words text-sm font-semibold leading-tight text-slate-950 sm:text-base">
        {value}
      </strong>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 p-3">
      <p className="text-xs leading-tight text-slate-500">{label}</p>
      <strong className="mt-1 block break-words text-sm font-semibold leading-tight text-slate-950">
        {value}
      </strong>
    </div>
  );
}

function InsightCard({ label, text, value }: { label: string; text: string; value: string }) {
  return (
    <article className="min-w-0 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-cyan-700">{label}</p>
      <strong className="mt-3 block break-words text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">
        {value}
      </strong>
      <p className="mt-3 text-sm leading-6 text-slate-500">{text}</p>
    </article>
  );
}
