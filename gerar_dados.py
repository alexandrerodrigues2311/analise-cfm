import csv
import io
import json
import sys
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile

CITIES = {
    '4304358': 'Candiota', '4301107': 'Arroio dos Ratos',
    '4301750': 'Barão do Triunfo', '4302709': 'Butiá',
    '4305355': 'Charqueadas', '4308805': 'General Câmara',
    '4312252': 'Minas do Leão', '4318408': 'São Jerônimo',
    '4322004': 'Triunfo',
}

with ZipFile(sys.argv[1]) as source:
    def rows(table):
        with source.open(table + '.txt') as file:
            yield from csv.DictReader(io.TextIOWrapper(file, encoding='cp1252'), delimiter=';')

    municipalities = {row['IDMunicipio']: row for row in rows('Municipio')}
    assert all(municipalities[code]['SGUF'] == 'RS' for code in CITIES)
    links = defaultdict(set)
    for row in rows('ProcessoMunicipio'):
        if row['IDMunicipio'] in CITIES:
            links[row['DSProcesso']].add(row['IDMunicipio'])

    phases = {row['IDFaseProcesso']: row['DSFaseProcesso'] for row in rows('FaseProcesso')}
    substances = {row['IDSubstancia']: row['NMSubstancia'] for row in rows('Substancia')}
    minerals = defaultdict(set)
    for row in rows('ProcessoSubstancia'):
        if row['DSProcesso'] in links and not row['DTFimVigencia'].strip():
            name = substances.get(row['IDSubstancia'])
            if name:
                minerals[row['DSProcesso']].add(name)

    processes = []
    for row in rows('Processo'):
        key = row['DSProcesso']
        if key in links:
            processes.append({
                'id': key, 'cities': sorted(links[key]), 'status': row['BTAtivo'],
                'phase': phases.get(row['IDFaseProcesso'], 'Sem fase informada'),
                'minerals': sorted(minerals[key]),
            })
    snapshot = max(item.date_time for item in source.infolist())
    data = {
        'cities': CITIES,
        'snapshot': '%04d-%02d-%02d' % snapshot[:3],
        'processes': sorted(processes, key=lambda row: row['id']),
    }

output = Path(__file__).with_name('dados.js')
output.write_text('const cadastro = ' + json.dumps(data, ensure_ascii=False) + ';\n', encoding='utf-8')
print(f'{len(processes)} processos em {len(CITIES)} municípios')
