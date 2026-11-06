const $ = id => document.getElementById(id);
const cities = Object.entries(cadastro.cities).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
const number = new Intl.NumberFormat('pt-BR');
const currency = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
const monthName = new Intl.DateTimeFormat('pt-BR', {month: 'long', timeZone: 'UTC'});
const yearSelect = $('finance-year');
const scope = $('scope');
const status = $('status');
const phase = $('phase');
const search = $('search');
const pageSize = 20;
const years = Object.keys(receitas.coverage.receipts).map(Number).sort((a, b) => b - a);
const latest = years[0];
const processById = new Map(cadastro.processes.map(row => [row.id, row]));
let processes = [];
let page = 0;

const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const date = value => value ? value.slice(0, 10).split('-').reverse().join('/') : 'Não informada';
const money = value => value === null ? '—' : currency.format(value / 100);
const month = value => monthName.format(new Date(Date.UTC(2000, value - 1, 1)));
const endMonth = year => Math.min(receitas.coverage.receipts[year], receitas.coverage.transfers[year]);
const period = year => endMonth(year) === 12 ? String(year) : year + ' · janeiro a ' + month(endMonth(year));
const active = rows => rows.filter(row => row.status === 'S');
const cityName = () => cadastro.cities[scope.value] ?? 'Visão geral dos municípios';
const inScope = code => scope.value === 'all' || scope.value === code;

function node(tag, text = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function rank(rows, labels, value = () => 1) {
  const totals = new Map();
  for (const row of rows) {
    for (const label of new Set(labels(row))) {
      if (label) totals.set(label, (totals.get(label) ?? 0) + value(row));
    }
  }
  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
}

function bars(target, entries, format = value => number.format(value), limit = 8, onClick) {
  const max = Math.max(1, ...entries.map(([, value]) => value));
  const items = entries.slice(0, limit).map(([label, value]) => {
    const row = node('div');
    row.className = 'bar-row';
    const title = node(onClick ? 'button' : 'span', label);
    if (onClick) {
      title.type = 'button';
      title.onclick = () => onClick(label);
    }
    const track = node('div');
    track.className = 'bar-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = node('i');
    fill.style.width = Math.max(0, value) / max * 100 + '%';
    track.append(fill);
    row.append(title, node('strong', format(value)), track);
    return row;
  });
  target.replaceChildren(...(items.length ? items : [node('p', 'Sem registros neste recorte.')]));
}

function table(target, headings, rows) {
  const wrapper = node('div');
  wrapper.className = 'table-box';
  const grid = node('table');
  const header = grid.createTHead().insertRow();
  for (const label of headings) {
    const cell = node('th', label);
    cell.scope = 'col';
    header.append(cell);
  }
  const body = grid.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    values.forEach(value => row.insertCell().append(value));
  }
  if (!rows.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = headings.length;
    cell.textContent = 'Sem registros neste recorte.';
  }
  wrapper.append(grid);
  target.replaceChildren(wrapper);
}

function totals(year, last, match = inScope, first = 1) {
  const result = [null, null];
  for (const [y, m, code, payments, transfers] of receitas.monthly) {
    if (y !== year || m < first || m > last || !match(code)) continue;
    [payments, transfers].forEach((value, index) => {
      if (value !== null) result[index] = (result[index] ?? 0) + value;
    });
  }
  return result;
}

function changeText(current, previous) {
  if (current === null || previous === null) return 'Comparação indisponível por ausência de registros.';
  if (!previous) return 'Diferença sobre o período anterior de ' + money(current - previous) + '.';
  const variation = (current - previous) / Math.abs(previous);
  const formatted = new Intl.NumberFormat('pt-BR', {style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero'}).format(variation);
  return formatted + ' em relação ao mesmo período de ' + (Number(yearSelect.value) - 1) + '.';
}

function payerName(company) {
  return company ? cadastro.companies[company] || 'CNPJ ' + company : 'Pessoa física · total agrupado';
}

function renderFinance() {
  const year = Number(yearSelect.value);
  const last = endMonth(year);
  const [payments, transfers] = totals(year, last);
  const previous = totals(year - 1, last);
  $('finance-period').textContent = period(year) + ' · período em comum entre as fontes.';
  $('finance-story').replaceChildren(
    node('p', 'Pagamentos: ' + money(payments) + '. ' + changeText(payments, previous[0])),
    node('p', 'Repasses: ' + money(transfers) + '. ' + changeText(transfers, previous[1])),
  );
  table($('finance-history'), ['Período', 'Pagamentos', 'Repasses'],
    years.map(y => [period(y), ...totals(y, endMonth(y)).map(money)]));
  const comparison = $('finance-comparison');
  comparison.hidden = scope.value !== 'all';
  if (!comparison.hidden) {
    table(comparison, ['Município', 'Pagamentos', 'Repasses'], cities.map(([code, label]) =>
      [label, ...totals(year, last, value => value === code).map(money)]));
  }
  table($('finance-monthly'), ['Mês', 'Pagamentos', 'Repasses'],
    Array.from({length: last}, (_, i) => [month(i + 1), ...totals(year, i + 1, inScope, i + 1).map(money)]));
  const details = receitas.payments.filter(([y, m, code]) => y === year && m <= last && inScope(code));
  const value = row => row[6];
  const payers = rank(details, row => [payerName(row[4])], value);
  if (payers.length && payments > 0 && payers[0][1] > 0) {
    const share = new Intl.NumberFormat('pt-BR', {style: 'percent', maximumFractionDigits: 1}).format(payers[0][1] / payments);
    $('finance-story').append(node('p', payers[0][0] + ' tem o maior valor registrado no período, com ' + share + ' dos pagamentos do recorte.'));
  }
  bars($('payers'), payers, money);
  bars($('paid-minerals'), rank(details, row => [row[5] || 'Sem substância informada'], value), money);
  table($('paid-processes'), ['Processo ANM', 'Total'], rank(details, row => [row[3] || 'Não informado'], value)
    .map(([id, amount]) => [processById.has(id) ? processButton(id) : id, money(amount)]));
}

function processButton(id) {
  const button = node('button', id);
  button.className = 'process-link';
  button.type = 'button';
  button.onclick = () => openProcess(id);
  return button;
}

function openProcess(id) {
  const process = processById.get(id);
  const content = $('detail-content');
  const heading = node('h2', process.id);
  heading.id = 'detail-title';
  const titles = node('div');
  const events = node('div');
  const payments = node('div');
  const paid = receitas.payments.filter(row => row[3] === id && inScope(row[2]));
  const paymentRows = rank(paid, row => [String(row[0])], row => row[6]).sort((a, b) => Number(b[0]) - Number(a[0]));
  table(titles, ['Título', 'Documento', 'Situação', 'Publicação'], process.titles.map(([n, type, state, published]) =>
    [n || '—', type || '—', state || '—', date(published)]));
  table(events, ['Data', 'Evento'], process.events.map(([when, event]) => [date(when), event]));
  table(payments, ['Ano', 'CFEM recolhida'], paymentRows.map(([year, amount]) =>
    [year === String(latest) ? year + ' · até ' + month(receitas.coverage.receipts[latest]) : year, money(amount)]));
  content.replaceChildren(heading,
    node('p', (process.status === 'S' ? 'Ativo' : 'Inativo') + ' · ' + process.phase),
    node('p', 'Protocolo: ' + date(process.protocol) + ' · Área total cadastrada: ' + (process.area ? process.area + ' ha' : '—')),
    node('p', 'NUP: ' + (process.nup || '—')),
    node('p', 'Municípios no recorte: ' + process.cities.map(code => cadastro.cities[code]).join(', ')),
    node('p', 'Titulares / requerentes: ' + (process.holders.join('; ') || '—')),
    node('p', 'Substâncias: ' + (process.minerals.join(', ') || '—')),
    node('h3', 'Títulos registrados'), titles,
    node('h3', 'Até cinco eventos recentes'), events,
    node('h3', 'Pagamentos de CFEM no território selecionado'), payments,
  );
  $('detail').showModal();
}

function renderProcesses(printing = false) {
  const term = normalize(search.value.trim());
  const filtered = processes.filter(row =>
    (status.value === 'all' || status.value === row.status) &&
    (phase.value === 'all' || phase.value === row.phase) &&
    normalize([row.id, ...row.holders, ...row.minerals].join(' ')).includes(term));
  const includeAll = $('print-full').checked;
  const display = printing
    ? (includeAll ? filtered : filtered.slice(0, pageSize))
    : filtered.slice(page * pageSize, (page + 1) * pageSize);
  $('print-scope').textContent = printing && display.length < filtered.length
    ? 'Amostra dos primeiros ' + display.length + ' processos conforme os filtros selecionados.'
    : '';
  const body = $('rows');
  body.replaceChildren();
  for (const row of display) {
    const tr = body.insertRow();
    const state = {S: 'Ativo', N: 'Inativo'}[row.status] ?? 'Não informado';
    [processButton(row.id), state + ' · ' + row.phase, row.holders.join('; ') || '—', row.minerals.join(', ') || '—']
      .forEach(value => tr.insertCell().append(value));
  }
  if (!display.length) {
    const empty = body.insertRow().insertCell();
    empty.colSpan = 4;
    empty.textContent = 'Nenhum processo corresponde aos filtros.';
  }
  $('process-count').textContent = number.format(filtered.length) + ' de ' + number.format(processes.length) + ' processos no recorte.';
  $('previous').disabled = page === 0;
  $('next').disabled = (page + 1) * pageSize >= filtered.length;
  $('page').textContent = filtered.length ? 'Página ' + (page + 1) + ' de ' + Math.ceil(filtered.length / pageSize) : 'Sem resultados';
}

function refreshProcesses() {
  page = 0;
  renderProcesses();
}

function selectScope() {
  processes = scope.value === 'all' ? cadastro.processes : cadastro.processes.filter(row => row.cities.includes(scope.value));
  const activeRows = active(processes);
  const phases = rank(activeRows, row => [row.phase]);
  const minerals = rank(activeRows, row => row.minerals);
  const holders = rank(activeRows, row => row.holders);
  const producing = activeRows.filter(row => /^(Concessão de Lavra|Licenciamento)$/i.test(row.phase)).length;
  const [payments, transfers] = totals(latest, endMonth(latest));
  const region = scope.value === 'all';
  $('title').textContent = cityName();
  $('lead').textContent = region
    ? 'Panorama integrado de nove municípios do Rio Grande do Sul. Selecione um município para abrir a ficha de inteligência mineral.'
    : 'Mineração e receita municipal. Conheça as fases dos processos, as substâncias, os titulares e a evolução da CFEM em ' + cityName() + '.';
  $('regional').hidden = !region;
  const insights = [];
  if (phases.length) insights.push('Entre os processos ativos, a fase mais frequente é ' + phases[0][0] +
    ', com ' + number.format(phases[0][1]) + ' registros.');
  if (minerals.length) insights.push('A substância mais frequente no cadastro ativo é ' +
    minerals[0][0].toLocaleLowerCase('pt-BR') + ', associada a ' + number.format(minerals[0][1]) + ' processos.');
  $('overview-story').textContent = insights.join(' ');
  $('metrics').replaceChildren(...[
    [number.format(processes.length), 'Processos no cadastro'],
    [number.format(activeRows.length), 'Processos ativos'],
    [number.format(producing), 'Ativos em concessão de lavra ou licenciamento'],
    [money(payments), 'Pagamentos · ' + period(latest)],
    [money(transfers), 'Repasses · ' + period(latest)],
  ].map(([value, label]) => {
    const article = node('article');
    article.append(node('strong', value), node('span', label));
    return article;
  }));
  phase.replaceChildren(new Option('Todas', 'all'), ...[...new Set(processes.map(row => row.phase))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).map(label => new Option(label)));
  status.value = 'all';
  search.value = '';
  bars($('phases'), phases, undefined, Infinity, label => {
    status.value = 'S';
    phase.value = label;
    refreshProcesses();
    $('processos').scrollIntoView();
  });
  bars($('minerals'), minerals);
  bars($('holders'), holders);
  $('agenda-mineral').textContent = producing
    ? 'Comece pelos ' + number.format(producing) + ' processos ativos em concessão de lavra ou licenciamento. Confira documentos e licenças e verifique quais áreas têm atividade.'
    : 'Acompanhe as mudanças de fase e confira com a ANM quais processos podem demandar ações de fiscalização ou planejamento.';
  refreshProcesses();
  renderFinance();
  const url = new URL(location.href);
  if (region) url.searchParams.delete('municipio');
  else url.searchParams.set('municipio', scope.value);
  history.replaceState(null, '', url);
}

scope.add(new Option('Visão geral · 9 municípios', 'all'));
for (const [code, label] of cities) {
  scope.add(new Option(label, code));
  const linked = cadastro.processes.filter(row => row.cities.includes(code));
  const button = node('button');
  button.append(node('b', label), node('span', number.format(active(linked).length) + ' ativos · ' + number.format(linked.length) + ' registros'));
  button.onclick = () => {
    scope.value = code;
    selectScope();
    $('panorama').scrollIntoView();
    scope.focus({preventScroll: true});
  };
  $('comparison').append(button);
}
for (const year of years) yearSelect.add(new Option(period(year), year));
const selected = new URLSearchParams(location.search).get('municipio');
if (Object.hasOwn(cadastro.cities, selected)) scope.value = selected;

$('today').textContent = new Intl.DateTimeFormat('pt-BR', {dateStyle: 'long', timeZone: 'America/Sao_Paulo'}).format(new Date());
$('snapshot').textContent = 'Cadastro Mineiro · ' + date(cadastro.snapshot);
$('financial-source').textContent = 'Arrecadação da ANM: cópia de 02/11/2026, com registros até ' +
  month(receitas.coverage.receipts[latest]) + ' de ' + latest + '. Repasses municipais do Tesouro Nacional: consulta de ' +
  date(receitas.transferDates[latest]) + ', com registros até ' + month(receitas.coverage.transfers[latest]) + ' de ' + latest + '.';
scope.onchange = selectScope;
status.onchange = phase.onchange = search.oninput = refreshProcesses;
yearSelect.onchange = renderFinance;
$('previous').onclick = () => { page--; renderProcesses(); };
$('next').onclick = () => { page++; renderProcesses(); };
$('print').onclick = () => window.print();
window.addEventListener('beforeprint', () => renderProcesses(true));
window.addEventListener('afterprint', () => renderProcesses());
selectScope();
