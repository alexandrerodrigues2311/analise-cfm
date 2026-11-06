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
            yield from csv.DictReader(io.TextIOWrapper(file, encoding='cp1252', errors='replace'), delimiter=';')

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

    parties = defaultdict(set)
    for row in rows('ProcessoPessoa'):
        if row['DSProcesso'] in links and row['IDTipoRelacao'] == '1' and not row['DTFimVigencia']:
            parties[row['DSProcesso']].add(row['IDPessoa'])
    party_ids = set().union(*parties.values())
    people = {}
    payer_ids = set()
    if len(sys.argv) > 2:
        with open(sys.argv[2], encoding='cp1252', newline='') as file:
            payer_ids = {
                row['CPF_CNPJ'].zfill(14) for row in csv.DictReader(file)
                if row['CodigoMunicipio'] in CITIES and row['Tipo_PF_PJ'] == 'PJ'
            }
    companies = {}
    for row in rows('Pessoa'):
        name = row['NMPessoa'].strip()
        if row['IDPessoa'] in party_ids:
            people[row['IDPessoa']] = name
        if row['TPPessoa'] == 'J' and row['NRCPFCNPJ'].zfill(14) in payer_ids:
            companies[row['NRCPFCNPJ'].zfill(14)] = name

    title_names = {r['IDDocumentoLegal']: r['DSDocumentoLegal'] for r in rows('DocumentoLegal')}
    title_status = {r['IDSituacaoDocumentoLegal']: r['DSSituacaoDocumentoLegal'] for r in rows('SituacaoDocumentoLegal')}
    titles = defaultdict(list)
    for row in rows('ProcessoTitulo'):
        if row['DSProcesso'] in links:
            titles[row['DSProcesso']].append([
                row['NRTitulo'], title_names.get(row['IDDocumentoLegal'], ''),
                title_status.get(row['IDSituacaoDocumentoLegal'], ''), row['DTPublicacao'],
            ])

    event_names = {r['IDEvento']: r['DSEvento'] for r in rows('Evento')}
    events = defaultdict(list)
    for row in rows('ProcessoEvento'):
        if row['DSProcesso'] in links:
            events[row['DSProcesso']].append([row['DTEvento'], event_names.get(row['IDEvento'], row['IDEvento'])])

    processes = []
    for row in rows('Processo'):
        key = row['DSProcesso']
        if key in links:
            processes.append({
                'id': key, 'cities': sorted(links[key]), 'status': row['BTAtivo'],
                'phase': phases.get(row['IDFaseProcesso']) or 'Sem fase informada',
                'minerals': sorted(minerals[key]),
                'holders': sorted({people[id] for id in parties[key] if people.get(id)}),
                'titles': sorted(titles[key], key=lambda title: title[3], reverse=True),
                'events': sorted(events[key], reverse=True)[:5],
                'protocol': row['DTProtocolo'][:10],
                'area': row['QTAreaHA'],
                'nup': row['NRNUP'],
            })
    snapshot = max(item.date_time for item in source.infolist())
    data = {
        'cities': CITIES,
        'snapshot': '%04d-%02d-%02d' % snapshot[:3],
        'companies': companies,
        'processes': sorted(processes, key=lambda row: row['id']),
    }

output = Path(__file__).with_name('dados.js')
output.write_text('const cadastro = ' + json.dumps(data, ensure_ascii=False) + ';\n', encoding='utf-8')
print(f'{len(processes)} processos em {len(CITIES)} municípios')
