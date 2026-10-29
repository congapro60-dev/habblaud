import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
const cachePath = join(codexHome, 'models_cache.json');
let outputPath = join(codexHome, '9router-free-models.json');
const router = (process.env.NINEROUTER_BASE_URL || 'http://127.0.0.1:20128/v1').replace(/\/$/, '');
const knownTools = new Set(['xk/qwen/qwen3.8-max:free', 'xk/anthropic/claude-sonnet-5.5', 'vilao60/deepseek-v4.1-flash']);

function parseJsonc(text) {
  const uncommented = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g,
    (match) => match.startsWith('"') ? match : '');
  return JSON.parse(uncommented.replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g,
    (match) => match.startsWith('"') ? match : ''));
}

async function getJson(url, key) {
  const response = await fetch(url, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} ${new URL(url).pathname}: HTTP ${response.status}`);
  return response.json();
}

function costGroup(model, provider) {
  if (provider === 'vilao60') return 'TRỪ VÍ';
  if (model.access_tier === 'free' && model.pricing?.input === 0 && model.pricing?.output === 0) return 'FREE';
  if (model.payg === true) return 'TRỪ VÍ';
  // ponytail: user's current plan is Pro ($5); recalculate this gate after plan changes.
  if (model.min_plan_usd > 5) return 'GÓI CAO HƠN';
  if (['paid', 'premium'].includes(model.access_tier)) return model.payg === false ? 'TRONG GÓI*' : 'GÓI/VÍ';
  return 'PHÍ CHƯA RÕ';
}

function retainedPShare(models, routes) {
  return models.filter((model) => model.slug === 'pshare/glm-5.3-flash' && routes.some((route) => route.id === model.slug));
}

function makeModel(base, route, metadata, provider, priority) {
  const model = structuredClone(base);
  const group = costGroup(metadata, provider);
  const advertisedContext = metadata.context_length ?? route.capabilities?.contextWindow;
  const context = Number.isSafeInteger(advertisedContext) && advertisedContext > 0 ? Math.min(256000, advertisedContext) : 128000;
  const tested = knownTools.has(route.id);
  const price = provider === 'vilao60'
    ? `Vilao tính theo token; input/output ${metadata.price_per_input_token}/${metadata.price_per_output_token} VND mỗi 1M; tối thiểu ${metadata.min_price_per_request} VND/lượt.`
    : group === 'FREE' ? 'Giá input/output 0 theo catalog xKiro; chịu hạn mức free/ngày.'
      : group === 'TRỪ VÍ' ? 'PAYG theo bảng giá xKiro: trừ ví mỗi lượt, không bao trong gói Pro.'
        : group === 'GÓI CAO HƠN' ? `Yêu cầu gói ${metadata.min_plan_names?.join('/') || 'cao hơn Pro'}; tài khoản Pro hiện tại chưa đủ.`
          : 'Trong gói khi có plan đang hoạt động và hạn mức; có thể trừ ví nếu bật wallet fallback. GÓI/VÍ nghĩa chưa xác minh PAYG từng model. Kiểm dashboard trước khi dùng.';
  Object.assign(model, {
    slug: route.id,
    display_name: `[${group} · ${provider === 'xk' ? 'xKiro' : 'Vilao'}] ${metadata.display_name || metadata.id}${tested ? '' : ' · thử nghiệm'}`,
    description: `${price} ${tested ? 'Codex shell canary PASS 2026-10-26.' : 'Catalog báo tools; chưa xác minh shell trong Codex.'} Vision tắt; account/served model/quota cần kiểm riêng. Không tự fallback.`,
    visibility: 'list', supported_in_api: true,
    default_reasoning_level: 'low',
    supported_reasoning_levels: [{ effort: 'low', description: 'Mặc định transport; chưa xác minh điều khiển effort upstream.' }],
    input_modalities: ['text'], context_window: context, max_context_window: context,
    supports_search_tool: false, supports_image_detail_original: false,
    supports_parallel_tool_calls: false,
    priority, additional_speed_tiers: [], service_tiers: [], default_service_tier: null,
    available_access_programs: Object.fromEntries(Object.keys(base.available_access_programs || { cyber: [] }).map((key) => [key, []])), upgrade: null,
    supports_experimental_context: false, supports_reasoning_effort_updates: false,
    experimental_supported_tools: [],
  });
  // ponytail: direct tools only; enable vision/code mode after route-specific canaries.
  delete model.tool_mode;
  return model;
}

function selfTest() {
  assert.equal(costGroup({ access_tier: 'free', pricing: { input: 0, output: 0 } }, 'xk'), 'FREE');
  assert.equal(costGroup({ id: 'fake:free', access_tier: 'paid' }, 'xk'), 'GÓI/VÍ');
  assert.equal(costGroup({ access_tier: 'premium', payg: true }, 'xk'), 'TRỪ VÍ');
  assert.equal(costGroup({ access_tier: 'paid', payg: false }, 'xk'), 'TRONG GÓI*');
  assert.equal(costGroup({ access_tier: 'free', pricing: { input: 1, output: 0 } }, 'xk'), 'PHÍ CHƯA RÕ');
  assert.equal(costGroup({ access_tier: 'paid', min_plan_usd: 100 }, 'xk'), 'GÓI CAO HƠN');
  assert.equal(costGroup({}, 'vilao60'), 'TRỪ VÍ');
  assert.deepEqual(parseJsonc('{/* x */ "url":"https://example.com/a,}", // x\n "n":1,}'), { url: 'https://example.com/a,}', n: 1 });
  assert.deepEqual(parseJsonc('{"a":1, "b":2,}'), { a: 1, b: 2 });
  const base = { tool_mode: 'code_mode_only', input_modalities: ['text', 'image'], available_access_programs: { cyber: ['allowed'] } };
  const model = makeModel(base, { id: 'xk/test' }, { id: 'test', context_length: 1000000 }, 'xk', 1);
  assert.equal(model.context_window, 256000);
  assert.equal(model.tool_mode, undefined);
  assert.deepEqual(model.input_modalities, ['text']);
  assert.equal(base.tool_mode, 'code_mode_only');
  assert.deepEqual(model.available_access_programs, { cyber: [] });
  assert.equal(makeModel(base, { id: 'xk/test' }, { id: 'test', context_length: -1 }, 'xk', 1).context_window, 128000);
  assert.equal(JSON.stringify(model).includes('apiKey'), false);
  const pshare = { slug: 'pshare/glm-5.3-flash' };
  assert.deepEqual(retainedPShare([pshare, { slug: 'pshare/zai-org/GLM-5.3-Flash' }], [{ id: pshare.slug }]), [pshare]);
  assert.deepEqual(retainedPShare([pshare], []), []);
  console.log('PASS: classification, JSONC, context ceiling, capability isolation, credential-free catalog');
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const config = await readFile(join(codexHome, 'config.toml'), 'utf8');
  const configuredCatalog = config.split(/^\s*\[/m)[0].match(/^model_catalog_json\s*=\s*("(?:\\.|[^"\\])*")/m);
  if (configuredCatalog) outputPath = JSON.parse(configuredCatalog[1]);
  const url = new URL(router);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('9Router must be loopback');
  const [cacheText, live, xkiro, xkiroPage, opencodeText] = await Promise.all([
    readFile(cachePath, 'utf8'), getJson(`${router}/models`, process.env.NINEROUTER_API_KEY),
    getJson('https://api.xkiro.com/v1/models'),
    fetch('https://xkiro.com/models', { signal: AbortSignal.timeout(15000), redirect: 'error' }).then(async (response) => {
      if (!response.ok) throw new Error(`xKiro pricing page HTTP ${response.status}`);
      return response.text();
    }),
    readFile(join(homedir(), '.config', 'opencode', 'opencode.jsonc'), 'utf8'),
  ]);
  const cached = JSON.parse(cacheText);
  const base = cached.models?.find((model) => model.slug === 'gpt-5.5');
  if (!base) throw new Error('Codex cached catalog has no direct-tool-compatible template');
  const vilaoConfig = parseJsonc(opencodeText).provider?.vilao60;
  let vilao = { data: [] };
  if (vilaoConfig) {
    if (vilaoConfig.options?.baseURL !== 'https://api.vilao.ai/v1') throw new Error('Unexpected Vilao endpoint');
    if (typeof vilaoConfig.options.apiKey !== 'string' || vilaoConfig.options.apiKey.startsWith('{')) throw new Error('Vilao needs a resolved existing credential');
    vilao = await getJson('https://api.vilao.ai/v1/models', vilaoConfig.options.apiKey);
  }
  const metadata = new Map([
    ...xkiro.data.map((model) => {
      // Catalog omits PAYG. The public pricing table explicitly distinguishes it.
      const row = [...xkiroPage.matchAll(/<tr data-id="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)].find((match) => match[1] === model.id);
      return [`xk/${model.id}`, [{ ...model, payg: row ? /Pay as you go/i.test(row[2]) : undefined }, 'xk']];
    }),
    ...vilao.data.filter((model) => model.active === true).map((model) => [`vilao60/${model.id}`, [model, 'vilao60']]),
  ]);
  const models = cached.models.filter((model) => !/^(xk|vilao60|pshare)\//.test(model.slug));
  for (const model of models) model.experimental_supported_tools ??= [];
  const originalCount = models.length;
  let priority = Math.max(0, ...models.map((model) => model.priority || 0)) + 1;
  const groups = {};
  const routes = live.data.filter((route) => metadata.has(route.id)).sort((a, b) => {
    const [ma, pa] = metadata.get(a.id); const [mb, pb] = metadata.get(b.id);
    return `${costGroup(ma, pa)} ${a.id}`.localeCompare(`${costGroup(mb, pb)} ${b.id}`);
  });
  for (const route of routes) {
    const [meta, provider] = metadata.get(route.id);
    if (!(meta.capabilities?.tools === true || meta.model_options?.supports_tools === true)) continue;
    models.push(makeModel(base, route, meta, provider, priority++));
    const group = costGroup(meta, provider);
    groups[group] = (groups[group] || 0) + 1;
  }
  if (models.length === originalCount) throw new Error('No eligible tool-advertised 9Router models found');
  // Keep the separately canary-tested alias; never auto-add PShare's paid canonical IDs.
  const previous = await readFile(outputPath, 'utf8').then(JSON.parse).catch((error) => {
    if (error.code === 'ENOENT') return { models: [] };
    throw error;
  });
  const retained = retainedPShare(previous.models, live.data);
  models.push(...retained);
  if (retained.length) groups['FREE · PShare (catalog)'] = retained.length;
  assert.equal(new Set(models.map((model) => model.slug)).size, models.length, 'Duplicate model slug');
  await mkdir(codexHome, { recursive: true });
  const temporary = `${outputPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ models }, null, 2)}\n`, 'utf8');
  await rename(temporary, outputPath);
  console.log(JSON.stringify({ outputPath, added: models.length - originalCount, groups }));
}
