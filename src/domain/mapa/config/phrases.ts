export const REPORT_PHRASES: Array<{
  code: string;
  category: string;
  text: string;
}> = [
  // Medicações atuais
  {
    code: "MED_NONE",
    category: "MEDICATION",
    text: "Não há relato de uso de medicações durante o exame.",
  },
  { code: "MED_CUSTOM", category: "MEDICATION", text: "{custom}" },
  {
    code: "MED_PREGNANCY",
    category: "MEDICATION",
    text: "Gestante de {months} meses.",
  },
  {
    code: "MED_OFFICE_BP",
    category: "MEDICATION",
    text: "PA de Consultório: BE sentado: {officeSystolic}/{officeDiastolic} mmHg. FC: {officeHeartRate}.",
  },

  // Comentários sobre o desempenho técnico
  {
    code: "TECH_SATISFACTORY",
    category: "TECHNICAL_QUALITY",
    text: "Procedimento de qualidade técnica satisfatória. Foram obtidas {validMeasurements} medições válidas nas 24 horas de exame, representando {validPercentage}% do total de medidas.",
  },
  {
    code: "TECH_COMPROMISED",
    category: "TECHNICAL_QUALITY",
    text: "Procedimento de qualidade técnica comprometida devido ao número total de medições válidas ({validMeasurements}) estar abaixo do limite para validação do método.",
  },
  {
    code: "TECH_BELOW_RECOMMENDED",
    category: "TECHNICAL_QUALITY",
    text: "Qualidade técnica abaixo do recomendável para a interpretação satisfatória dos dados.",
  },
  {
    code: "TECH_SUGGEST_REPEAT",
    category: "TECHNICAL_QUALITY",
    text: "Sugerimos repetição do exame.",
  },

  // Médias pressóricas — 24h
  {
    code: "AVG_24H_BOTH_NORMAL",
    category: "AVERAGE_PRESSURE",
    text: "A média pressórica, sistólica e diastólica, total no MAPA 24 horas está normal: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_24H_BOTH_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "As médias pressóricas, tanto sistólica quanto diastólica, totais no MAPA 24 horas estão elevadas: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_24H_BOTH_SIGNIFICANTLY_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "As médias pressóricas, tanto sistólica quanto diastólica, totais no MAPA 24 horas estão significativamente elevadas: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_24H_SYS_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "A média pressórica total no MAPA 24 horas, especificamente o componente sistólico, está elevada: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_24H_SYS_SIGNIFICANTLY_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "A média pressórica total no MAPA 24 horas, especificamente o componente sistólico, está significativamente elevada: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_24H_DIA_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "A média pressórica total no MAPA 24 horas, especificamente o componente diastólico, está elevada: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_24H_DIA_SIGNIFICANTLY_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "A média pressórica total no MAPA 24 horas, especificamente o componente diastólico, está significativamente elevada: {systolic}/{diastolic} mmHg.",
  },

  // Médias — vigília
  {
    code: "AVG_AWAKE_BOTH_NORMAL",
    category: "AVERAGE_PRESSURE",
    text: "Na Vigília, as médias dos valores pressóricos sistólico e diastólico, estão normais: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_AWAKE_SYS_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "Na Vigília, a média dos valores pressóricos sistólicos está elevada: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_AWAKE_DIA_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "Na Vigília, a média dos valores pressóricos diastólicos está elevada: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_AWAKE_BOTH_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "Na Vigília, as médias dos valores pressóricos, sistólicos e diastólicos, estão elevadas: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_AWAKE_SYS_NORMAL",
    category: "AVERAGE_PRESSURE",
    text: "A média pressórica sistólica na Vigília está normal.",
  },
  {
    code: "AVG_AWAKE_DIA_NORMAL",
    category: "AVERAGE_PRESSURE",
    text: "A média da pressão diastólica na Vigília está normal.",
  },

  // Médias — sono
  {
    code: "AVG_SLEEP_BOTH_NORMAL",
    category: "AVERAGE_PRESSURE",
    text: "No Sono, as médias dos valores pressóricos sistólico e diastólico, estão normais: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_SLEEP_SYS_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "No Sono, a média dos valores pressóricos sistólicos está elevada: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_SLEEP_DIA_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "No Sono, a média dos valores pressóricos diastólicos está elevada: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_SLEEP_BOTH_ELEVATED",
    category: "AVERAGE_PRESSURE",
    text: "No Sono, as médias dos valores pressóricos, sistólicos e diastólicos estão elevadas: {systolic}/{diastolic} mmHg.",
  },
  {
    code: "AVG_SLEEP_SYS_NORMAL",
    category: "AVERAGE_PRESSURE",
    text: "A média pressórica sistólica no Sono está normal.",
  },
  {
    code: "AVG_SLEEP_DIA_NORMAL",
    category: "AVERAGE_PRESSURE",
    text: "A média da pressão diastólica no Sono está normal.",
  },

  // Cargas pressóricas
  {
    code: "LOAD_BOTH_PERIODS_NORMAL",
    category: "PRESSURE_LOAD",
    text: "Cargas pressóricas na Vigília e no Sono normais.",
  },
  {
    code: "LOAD_AWAKE_BOTH_NORMAL",
    category: "PRESSURE_LOAD",
    text: "Cargas pressóricas sistólica e diastólica normais na Vigília.",
  },
  {
    code: "LOAD_SLEEP_BOTH_NORMAL",
    category: "PRESSURE_LOAD",
    text: "Cargas pressóricas sistólica e diastólica normais no Sono.",
  },
  {
    code: "LOAD_AWAKE_SYS_ELEVATED",
    category: "PRESSURE_LOAD",
    text: "Carga pressórica sistólica elevada na Vigília ({percent}%).",
  },
  {
    code: "LOAD_AWAKE_DIA_ELEVATED",
    category: "PRESSURE_LOAD",
    text: "Carga pressórica diastólica elevada na Vigília ({percent}%).",
  },
  {
    code: "LOAD_SLEEP_SYS_ELEVATED",
    category: "PRESSURE_LOAD",
    text: "Carga pressórica sistólica elevada no Sono ({percent}%).",
  },
  {
    code: "LOAD_SLEEP_DIA_ELEVATED",
    category: "PRESSURE_LOAD",
    text: "Carga pressórica diastólica elevada no Sono ({percent}%).",
  },
  {
    code: "LOAD_SYS_BOTH_NORMAL",
    category: "PRESSURE_LOAD",
    text: "Cargas pressóricas sistólicas normais na Vigília e no Sono.",
  },
  {
    code: "LOAD_DIA_BOTH_NORMAL",
    category: "PRESSURE_LOAD",
    text: "Cargas pressóricas diastólicas normais na Vigília e no Sono.",
  },

  // Picos pressóricos
  {
    code: "PEAK_AWAKE_AND_SLEEP",
    category: "PRESSURE_PEAK",
    text: "Picos pressóricos durante a Vigília e o Sono.",
  },
  {
    code: "PEAK_AWAKE",
    category: "PRESSURE_PEAK",
    text: "Pico pressórico durante a Vigília.",
  },
  {
    code: "PEAK_SLEEP",
    category: "PRESSURE_PEAK",
    text: "Pico pressórico durante o Sono.",
  },
  {
    code: "PEAK_HR",
    category: "PRESSURE_PEAK",
    text: "Concomitante aumento da frequência cardíaca.",
  },
  {
    code: "PEAK_STRESS",
    category: "PRESSURE_PEAK",
    text: "Relato de estresse físico-emocional neste momento.",
  },
  {
    code: "PEAK_MORNING",
    category: "PRESSURE_PEAK",
    text: "Pico pressórico matutino, ao acordar.",
  },
  { code: "PEAK_NOTES", category: "PRESSURE_PEAK", text: "{notes}" },

  // Descenso pressórico noturno
  {
    code: "DIP_BOTH_NORMAL",
    category: "NIGHT_DIPPING",
    text: "Descensos pressóricos sistólico e diastólico normais.",
  },
  {
    code: "DIP_SYS_ATTENUATED",
    category: "NIGHT_DIPPING",
    text: "Descenso sistólico atenuado ({percent}%).",
  },
  {
    code: "DIP_DIA_ATTENUATED",
    category: "NIGHT_DIPPING",
    text: "Descenso diastólico atenuado ({percent}%).",
  },
  {
    code: "DIP_BOTH_ACCENTUATED",
    category: "NIGHT_DIPPING",
    text: "Descenso sistólico e diastólico acentuados ({systolicPercent}% / {diastolicPercent}%).",
  },
  {
    code: "DIP_ABSENT",
    category: "NIGHT_DIPPING",
    text: "Ausência de descenso pressórico noturno.",
  },
  {
    code: "DIP_SYS_ACCENTUATED",
    category: "NIGHT_DIPPING",
    text: "Descenso sistólico acentuado ({percent}%).",
  },
  {
    code: "DIP_DIA_ACCENTUATED",
    category: "NIGHT_DIPPING",
    text: "Descenso diastólico acentuado ({percent}%).",
  },

  // Situações especiais
  {
    code: "SPECIAL_PREGNANT",
    category: "SPECIAL_SITUATION",
    text: "Considerar os valores mensurados em exame realizado em gestante.",
  },
  {
    code: "SPECIAL_ALCOHOL",
    category: "SPECIAL_SITUATION",
    text: "Relato de uso de álcool.",
  },
  {
    code: "SPECIAL_SMOKING",
    category: "SPECIAL_SITUATION",
    text: "Relato de tabagismo.",
  },
  {
    code: "SPECIAL_INSOMNIA",
    category: "SPECIAL_SITUATION",
    text: "Relato de insônia.",
  },
  {
    code: "SPECIAL_CAFFEINE",
    category: "SPECIAL_SITUATION",
    text: "Relato de uso de cafeína.",
  },
  {
    code: "SPECIAL_ORTHOSTATIC",
    category: "SPECIAL_SITUATION",
    text: "Redução pressórica ortostática.",
  },
  {
    code: "SPECIAL_NAP",
    category: "SPECIAL_SITUATION",
    text: "Redução pressórica associada à sesta.",
  },
  {
    code: "SPECIAL_POSTPRANDIAL",
    category: "SPECIAL_SITUATION",
    text: "Redução pressórica pós-prandial.",
  },
  {
    code: "SPECIAL_BISOPROLOL",
    category: "SPECIAL_SITUATION",
    text: "Valores pressóricos em consultório normais, na vigência de Bisoprolol 2,5mg/24h (SIC).",
  },
  {
    code: "SPECIAL_OFFICE_HIGH",
    category: "SPECIAL_SITUATION",
    text: "Pressão Arterial sistólica e/ou diastólica, no consultório, elevada.",
  },

  // Considerações gerais
  {
    code: "OFFICE_VS_MAPA_WHITE_COAT",
    category: "GENERAL_CONSIDERATION",
    text: "Os valores das médias pressóricas 24horas do MAPA comparadas aos valores de consultório sugerem Hipertensão do Avental Branco.",
  },
  {
    code: "OFFICE_VS_MAPA_MASKED",
    category: "GENERAL_CONSIDERATION",
    text: "Os valores das médias pressóricas do MAPA 24horas comparadas aos valores do consultório sugerem Hipertensão Mascarada.",
  },
  {
    code: "OFFICE_VS_MAPA_NORMOTENSION",
    category: "GENERAL_CONSIDERATION",
    text: "Os valores das médias pressóricas do MAPA 24horas comparadas aos valores de consultório são compatíveis com Normotensão Verdadeira.",
  },
  {
    code: "OFFICE_VS_MAPA_SUSTAINED",
    category: "GENERAL_CONSIDERATION",
    text: "Os valores das médias pressóricas do MAPA 24horas comparadas aos valores de consultório são compatíveis com Hipertensão Arterial Sustentada.",
  },
  {
    code: "GENERAL_NAP_PHYSIOLOGIC",
    category: "GENERAL_CONSIDERATION",
    text: "Observamos comportamento fisiológico da Pressão Arterial, relacionada ao período de sesta (sono durante o dia).",
  },
  {
    code: "GUIDELINE_FOOTER",
    category: "GENERAL_CONSIDERATION",
    text: "As considerações descritas neste laudo são fundamentadas na Diretriz Brasileira de Hipertensão Arterial – 2025.",
  },

  // Conclusão
  {
    code: "CONCLUSION_NORMOTENSION",
    category: "CONCLUSION",
    text: "Exame com valores compatíveis com Normotensão Arterial Verdadeira.",
  },
  {
    code: "CONCLUSION_SUSTAINED",
    category: "CONCLUSION",
    text: "Exame com valores compatíveis com Hipertensão Arterial Sustentada.",
  },
  {
    code: "CONCLUSION_WHITE_COAT",
    category: "CONCLUSION",
    text: "Exame com valores compatíveis com Hipertensão do Avental Branco.",
  },
  {
    code: "CONCLUSION_MASKED",
    category: "CONCLUSION",
    text: "Exame com valores compatíveis com Hipertensão Arterial Mascarada.",
  },
  {
    code: "CONCLUSION_NORMOTENSION_ALTERED_AWAKE_SYS",
    category: "CONCLUSION",
    text: "Exame com valores compatíveis com Normotensão Arterial, porém resultado alterado pela elevação da média total da Pressão Arterial Sistólica na Vigília.",
  },
  {
    code: "CONCLUSION_NORMOTENSION_ALTERED_DIPPING",
    category: "CONCLUSION",
    text: "Valores compatíveis com Normotensão, porém resultado alterado devido ao descenso pressórico noturno anormal.",
  },
  {
    code: "CONCLUSION_CONSIDER_STRESS_OR_MEDS",
    category: "CONCLUSION",
    text: "Considerar, durante o exame, efeito de estresse físico/ emocional ou medicações com efeito cardiovascular.",
  },
  {
    code: "CONCLUSION_MISSING_OFFICE",
    category: "CONCLUSION",
    text: "A conclusão consultório × MAPA depende da PA de consultório, que não foi informada neste exame.",
  },
];
