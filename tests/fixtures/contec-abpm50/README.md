# Fixtures CONTEC ABPM50

Golden files usados para provar que o parser lê o mesmo que o software oficial da CONTEC.

Enquanto esta pasta não tiver um par de arquivos, o parser é **EXPERIMENTAL**: nenhuma versão de
`.awp` está marcada como `VERIFIED` em `src/domain/mapa/import/awp/verifiedFormats.ts`.

## Como adicionar um caso

1. Exporte o exame no software do aparelho e **anonimize** o arquivo: remova nome, documento,
   endereço, telefone e qualquer identificador do paciente. Mantenha as medições intactas.
2. Salve como `exam-001.awp` nesta pasta.
3. Abra o mesmo exame no software oficial da CONTEC e transcreva os números que ele apresenta
   para `exam-001.expected.json`:

```json
{
  "measurementCount": 76,
  "validMeasurements": 74,
  "avg24hSystolic": 127,
  "avg24hDiastolic": 70,
  "sleepWindow": { "start": "22:45", "end": "06:30" },
  "avgAwakeSystolic": 130,
  "avgAwakeDiastolic": 72,
  "avgSleepSystolic": 112,
  "avgSleepDiastolic": 63
}
```

Todos os campos são opcionais: o teste compara apenas os que existirem no JSON.
`sleepWindow` só é necessário quando o arquivo não declara o período de sono.

4. Rode `npm test`. O teste `contec-abpm50 golden files` passa a exercitar o par automaticamente.
5. Se os números coincidirem, registre o `detectedFormat` do arquivo em
   `src/domain/mapa/import/awp/verifiedFormats.ts` para que aquela versão passe a valer como
   `VERIFIED`.

Não comite arquivos com dado de paciente real identificável.
