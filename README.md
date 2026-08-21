# Laudos MAPA

MVP interno para geração assistida de laudos de Monitorização Ambulatorial da Pressão Arterial.

Fluxo: cadastrar paciente → criar exame → motor de regras → frases → laudo determinístico → (opcional) redação com OpenAI → revisar → aprovar → imprimir.

A IA **não classifica** parâmetros clínicos. Se a OpenAI falhar, o laudo determinístico é usado.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma + SQLite (preparado para PostgreSQL)
- Auth.js (Credentials), perfil `DOCTOR`
- OpenAI apenas no backend
- Zod + Vitest

## Instalação

```bash
npm install
cp .env.example .env
```

## Configuração `.env`

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET=
AUTH_TRUST_HOST="true"
AUTH_DOCTOR_EMAIL="medico@local"
AUTH_DOCTOR_PASSWORD="mapa123"
OPENAI_API_KEY=
OPENAI_MODEL="gpt-4o-mini"
```

`OPENAI_API_KEY` é opcional. Sem ela, o sistema gera laudo completo pelo Rule Engine.

Login padrão após o seed: `medico@local` / `mapa123`.

## Migration Prisma e seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

O seed cria o médico e o catálogo de frases.

## Como rodar

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Testes

```bash
npm test
```

## Arquitetura

- `src/domain/mapa`: regras clínicas, thresholds, frases, builder determinístico
- `src/domain/mapa/import/awp`: leitura do arquivo `.awp` do CONTEC ABPM50
- `src/domain/mapa/services/MapaMetricsCalculator.ts`: médias, cargas, descenso e picos
- `src/services/reports`: orquestração da geração
- `src/services/imports`: upload, análise, preview e importação do arquivo do aparelho
- `src/services/ai`: OpenAI, validação pós-IA, preços, consumo
- `src/parsers/mapa`: parser legado (mock/CSV/PDF/XML), não usado pelo fluxo de importação
- `src/app`: UI e server actions (sem lógica médica)

Uma futura base de conhecimento/RAG pode ser adicionada; este MVP não usa embeddings nem busca semântica.

## Rule Engine

`MapaRuleEngine.evaluate(data)` devolve `RuleResult[]`. Médias 24h/vigília/sono usam `mapaThresholds`. Parâmetros sem corte médico retornam `PENDING_MEDICAL_CONFIGURATION`.

## Importação de arquivo `.AWP` (CONTEC ABPM50)

Em **Novo laudo** há duas opções: preencher manualmente ou importar o arquivo exportado pelo
software do aparelho. O fluxo da importação é:

```
.awp → detecção de formato/codificação → parser → validação → métricas
     → preview para conferência → confirmação → laudo → Rule Engine existente
```

Nada é gravado no laudo antes da confirmação no preview. Pressão, frequência cardíaca, data,
hora e a marcação de medição válida/inválida vêm exclusivamente do arquivo, extraídas de forma
determinística. A IA não participa dessa leitura.

### Status do parser: EXPERIMENTAL

`CONTEC_AWP_PARSER_VERSION = "1.0.0"`. Nenhuma versão de `.awp` foi conferida contra o software
oficial da CONTEC, então `VERIFIED_AWP_FORMATS` está vazio e a confiança máxima é `PARTIAL`.
Arquivos cuja estrutura não é reconhecida ficam em `UNKNOWN` e têm a importação bloqueada.

O parser lê registros em que o próprio arquivo diz o que cada número significa:

- campos rotulados: `1=Date:2024-09-13,Time:08:30,SYS:127,DIA:70,PR:72`;
- colunas declaradas em metadado: `DataFormat=Time,SYS,DIA,PR` + `1=08:30,127,70,72`.

Registros **hexadecimais** são reconhecidos mas não decodificados: `hexLayouts.ts` está vazio de
propósito, porque sem um arquivo real conferido qualquer offset seria adivinhação. Esses
registros viram `UNDECODED_RECORD` e ficam disponíveis no AWP Inspector.

### Vigília e sono

Não existe janela padrão. O parser procura o período de sono declarado no arquivo; se não
encontrar, o preview pede os horários ao médico. Sem janela, médias de vigília/sono, cargas e
descenso noturno ficam nulos em vez de assumir 22h–06h.

### Rastreabilidade

Cada importação grava um `MapaSourceFile` com o arquivo original byte a byte, SHA-256, tamanho,
nome original, codificação, formato/versão detectados, versão do parser, confiança e data da
importação.

### AWP Inspector (somente desenvolvimento)

`/dev/awp-inspector` mostra metadados, registros, hex viewer (offset, hex, decimal, ASCII) e
tudo o que não foi interpretado. Existe também `[ Analisar estrutura com IA ]`, que envia apenas
uma descrição estrutural anonimizada e devolve hipóteses marcadas como experimentais — nenhuma
sugestão altera o parser. A rota retorna 404 fora de `development`.

### Suportar outra versão de `.awp`

1. Inspecione o arquivo em `/dev/awp-inspector`.
2. Se os campos forem rotulados ou declarados, provavelmente já funciona; complete o vocabulário
   em `decoders/fields.ts` se necessário.
3. Se forem bytes, confirme o layout em vários registros e registre-o em `decoders/hexLayouts.ts`.
4. Adicione o par golden em `tests/fixtures/contec-abpm50/` e rode `npm test`.
5. Só então registre o `formatId` em `verifiedFormats.ts` para promover a versão a `VERIFIED`.

## OpenAI

`AiReportService` recebe o rascunho já classificado e pede JSON por seção. Cada request é isolado (sem histórico entre pacientes). A chave nunca vai ao frontend.

## Fallback

Se a API falhar, timeout, JSON inválido, schema Zod falhar ou `AiReportValidator` rejeitar (números, conclusão, medicamentos), usa-se o texto determinístico e registra `FALLBACK_USED`.

## PARÂMETROS PENDENTES DE VALIDAÇÃO MÉDICA

1. Limite entre “elevado” e “significativamente elevado”
2. Percentual mínimo de medições válidas
3. Limites de cargas pressóricas
4. Valores de descenso normal / atenuado / acentuado / ausente
5. Critérios objetivos para picos pressóricos

Também pendente: limiar de pressão de consultório para classificar normotensão / hipertensão sustentada / avental branco / mascarada. Não foi inventado 140/90.

Na importação, as cargas pressóricas são calculadas como percentual de medições acima dos
limiares de vigília (135/85) e sono (120/70) já configurados em `thresholds.ts`. O número é
apresentado; a classificação clínica continua pendente.

## PENDENTE DE VALIDAÇÃO TÉCNICA DO PARSER

O parser `.awp` nunca foi comparado com o resultado do software oficial da CONTEC. Antes de usar
a importação em laudo real, confira as medições do preview contra o software do aparelho e
registre o caso em `tests/fixtures/contec-abpm50/`.
