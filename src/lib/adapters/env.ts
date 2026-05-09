type EnvResolver = (name: string) => string | undefined | Promise<string | undefined>;

interface EnvModule {
  resolveEnv?: EnvResolver;
  getEnv?: EnvResolver;
  getEnvValue?: (names: string[]) => string | undefined;
  env?: Record<string, string | undefined>;
}

let resolverPromise: Promise<EnvResolver | undefined> | undefined;

export async function resolveEnv(name: string, aliases: string[] = []): Promise<string | undefined> {
  for (const key of [name, ...aliases]) {
    const external = await getExternalResolver();
    const externalValue = await external?.(key);
    const value = normalizeEnvValue(externalValue ?? readProcessEnv(key));
    if (value) {
      return value;
    }
  }

  return undefined;
}

export async function hasEnv(name: string, aliases: string[] = []): Promise<boolean> {
  return Boolean(await resolveEnv(name, aliases));
}

async function getExternalResolver(): Promise<EnvResolver | undefined> {
  resolverPromise ??= loadExternalResolver();
  return resolverPromise;
}

async function loadExternalResolver(): Promise<EnvResolver | undefined> {
  try {
    const modulePath = "../env";
    const mod = (await import(modulePath)) as EnvModule;
    if (typeof mod.resolveEnv === "function") {
      return mod.resolveEnv;
    }
    if (typeof mod.getEnv === "function") {
      return mod.getEnv;
    }
    if (typeof mod.getEnvValue === "function") {
      return (name: string) => mod.getEnvValue?.([name]);
    }
    if (mod.env && typeof mod.env === "object") {
      return (name: string) => mod.env?.[name];
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function readProcessEnv(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
