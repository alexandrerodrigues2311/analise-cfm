import csv
import gzip
import json
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

root = Path(__file__).parent
cadastro = json.loads((root / 'dados.js').read_text(encoding='utf-8').removeprefix('const cadastro = ').strip().removesuffix(';'))
cities = cadastro['cities']
years = range(2022, 2027)
monthly = defaultdict(lambda: [None, None])
coverage = {'receipts': {}, 'transfers': {}}

def add(year, month, city, column, cents):
    entry = monthly[(year, month, city)]
    entry[column] = (entry[column] or 0) + cents

with open(sys.argv[1], encoding='cp1252', newline='') as file:
    for row in csv.DictReader(file):
        year = int(row['Ano'])
        if year not in years:
            continue
        month = int(row['Mês'])
        coverage['receipts'][year] = max(month, coverage['receipts'].get(year, 0))
        city = row['CodigoMunicipio']
        if city in cities and row['UF'].strip() == 'RS':
            cents = int(Decimal(row['ValorRecolhido'].replace(',', '.')) * 100)
            add(year, month, city, 0, cents)

for year in years:
    with gzip.open(Path(sys.argv[2]) / f'M-{year}.json.gz', 'rt', encoding='utf-8') as file:
        source = json.load(file)
    seen = set()
    for raw in source['rows']:
        row = {key.lower(): value for key, value in raw.items()}
        if row['transferencia'] != 'Royalties - CFEM':
            continue
        month = int(row['mes'])
        coverage['transfers'][year] = max(month, coverage['transfers'].get(year, 0))
        city = str(row['co_ibge'])
        if city in cities and row['uf'] == 'RS':
            key = (city, month)
            assert key not in seen, key
            seen.add(key)
            add(year, month, city, 1, int(Decimal(str(row['valor'])) * 100))

assert all(coverage[k].get(y) == 12 for k in coverage for y in range(2022, 2026))
assert all(coverage[k].get(2026) for k in coverage)
assert set(city for _, _, city in monthly) == set(cities)
payload = {
    'coverage': coverage,
    'monthly': [[y, m, city, *values] for (y, m, city), values in sorted(monthly.items())],
}
(root / 'receitas.js').write_text('const receitas = ' + json.dumps(payload, separators=(',', ':')) + ';\n', encoding='utf-8')
print(coverage)
print(len(monthly), 'linhas municipais mensais')
