# Análise CFM

Painel de mineração e CFEM para Candiota e oito municípios do Rio Grande do Sul. A página de Candiota do projeto original está em `candiota.html`.

Abra `index.html` no navegador ou sirva a pasta com `python -m http.server 8000`. O site é estático e os dados são distribuídos junto com os arquivos da interface.

## Atualização dos dados

1. Execute `python gerar_dados.py caminho/anm-scm.zip` com o ZIP do Cadastro Mineiro.
2. Execute `python gerar_receitas.py caminho/CFEM_Arrecadacao_2022_2026.csv pasta-dos-repasses`. A pasta deve conter os arquivos compactados `M-2022.json.gz` a `M-2026.json.gz`, com o objeto do Tesouro Nacional e sua lista de registros municipais em `rows`. A fonte é a [API de transferências do Tesouro](https://apiapex.tesouro.gov.br/aria/v1/transferencias_constitucionais/custom/por_estado_municipio).
3. Confira os períodos e atualize a descrição da coleta na seção Fontes do painel.

O painel soma os registros em centavos por município e mês. A comparação anual usa os meses cobertos pelas duas fontes e preserva a ausência de registros como valor ausente.
