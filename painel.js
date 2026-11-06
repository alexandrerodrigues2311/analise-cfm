const byId = id => document.getElementById(id);
const cities = Object.entries(cadastro.cities);
const number = new Intl.NumberFormat('pt-BR');
const pageSize = 20;
const city = byId('city');
const status = byId('status');
const phase = byId('phase');
const search = byId('search');
let page = 0;

function normalize(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function node(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

const byCity = new Map(cities.map(([code]) => [
  code, cadastro.processes.filter(process => process.cities.includes(code)),
]));
const active = rows => rows.filter(process => process.status === 'S').length;
const maximum = Math.max(1, ...Array.from(byCity.values(), active));

for (const [code, name] of cities) {
  city.add(new Option(name, code));
  const rows = byCity.get(code);
  const count = active(rows);
  const button = node('button', name);
  button.dataset.city = code;
  button.append(node('strong', number.format(count) + ' ativos'));
  button.append(node('span', number.format(rows.length) + ' registros'));
  const bar = node('div', '');
  bar.className = 'bar';
  const fill = node('i', '');
  fill.style.width = count / maximum * 100 + '%';
  bar.append(fill);
  button.append(bar);
  button.addEventListener('click', () => {
    city.value = code;
    selectCity();
    city.focus();
  });
  byId('comparison').append(button);
}

function selectCity() {
  const rows = byCity.get(city.value);
  const phases = [...new Set(rows.map(row => row.phase))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  phase.replaceChildren(new Option('Todas', 'all'), ...phases.map(value => new Option(value)));
  byId('city-title').textContent = cadastro.cities[city.value] + ' · processos minerários';
  for (const button of byId('comparison').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.city === city.value));
  }
  refresh();
}

function refresh() {
  page = 0;
  render();
}

function render() {
  const rows = byCity.get(city.value);
  const term = normalize(search.value.trim());
  const filtered = rows.filter(row =>
    (status.value === 'all' || row.status === status.value) &&
    (phase.value === 'all' || row.phase === phase.value) &&
    normalize([row.id, ...row.minerals].join(' ')).includes(term)
  );
  const stats = [
    [rows.length, 'processos no cadastro'],
    [active(rows), 'processos ativos no cadastro'],
    [filtered.length, 'processos nos filtros atuais'],
  ];
  byId('stats').replaceChildren(...stats.map(([value, label]) => {
    const article = node('article', '');
    article.append(node('strong', number.format(value)), node('span', label));
    return article;
  }));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const body = byId('rows');
  body.replaceChildren(...visible.map(row => {
    const tr = node('tr', '');
    const situation = {S: 'Ativo', N: 'Inativo'}[row.status] ?? 'Não informada';
    tr.append(...[row.id, situation, row.phase, row.minerals.join(', ') || '—'].map(value => node('td', value)));
    return tr;
  }));
  if (!visible.length) {
    const message = node('td', 'Nenhum processo corresponde aos filtros.');
    message.colSpan = 4;
    body.insertRow().append(message);
  }
  byId('previous').disabled = page === 0;
  byId('next').disabled = (page + 1) * pageSize >= filtered.length;
  byId('page').textContent = filtered.length
    ? `Página ${page + 1} de ${Math.ceil(filtered.length / pageSize)}`
    : 'Sem resultados';
}

city.addEventListener('change', selectCity);
status.addEventListener('change', refresh);
phase.addEventListener('change', refresh);
search.addEventListener('input', refresh);
byId('previous').addEventListener('click', () => { page--; render(); });
byId('next').addEventListener('click', () => { page++; render(); });
byId('snapshot').textContent = 'Data registrada no arquivo do cadastro: ' + cadastro.snapshot.split('-').reverse().join('/') + '.';
selectCity();

const money = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
const financeYear = byId('finance-year');
const financeCity = byId('finance-city');
const years = Object.keys(receitas.coverage.receipts).map(Number).sort((a, b) => b - a);
const endMonth = year => Math.min(receitas.coverage.receipts[year], receitas.coverage.transfers[year]);
const months = new Intl.DateTimeFormat('pt-BR', {month: 'long', timeZone: 'UTC'});
const amount = value => value === null ? '—' : money.format(value / 100);
const totals = new Map();

for (const [year, month, code, payments, transfers] of receitas.monthly) {
  if (month > endMonth(year)) continue;
  const key = year + ':' + code;
  const values = totals.get(key) ?? [null, null];
  for (const [index, value] of [payments, transfers].entries()) {
    if (value !== null) values[index] = (values[index] ?? 0) + value;
  }
  totals.set(key, values);
}

function period(year) {
  const month = endMonth(year);
  return month === 12 ? String(year) :
    year + ' · janeiro a ' + months.format(new Date(Date.UTC(year, month - 1, 1)));
}

function moneyRow(label, year, code) {
  const row = node('tr', '');
  const heading = node('th', label);
  heading.scope = 'row';
  const values = totals.get(year + ':' + code) ?? [null, null];
  row.append(heading, ...values.map(value => node('td', amount(value))));
  return row;
}

function compareFinance() {
  const year = Number(financeYear.value);
  byId('finance-period').textContent = 'Período em comum nas duas fontes: ' + period(year) + '.';
  byId('finance-rows').replaceChildren(...cities.map(([code, name]) => moneyRow(name, year, code)));
}

function historyFinance() {
  byId('finance-history').replaceChildren(...years.map(year => moneyRow(period(year), year, financeCity.value)));
}

for (const year of years) financeYear.add(new Option(period(year), year));
for (const [code, name] of cities) financeCity.add(new Option(name, code));
financeCity.value = '4304358';
financeYear.addEventListener('change', compareFinance);
financeCity.addEventListener('change', historyFinance);
compareFinance();
historyFinance();
