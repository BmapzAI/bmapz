#!/usr/bin/env node
/**
 * One-off: fix UTF-8 replacement-char (U+FFFD) corruption in Portuguese strings
 * across all frontend files. Run with: node scripts/fix-utf8-corruption.cjs
 *
 * Strategy:
 *  - Only operate on files that contain U+FFFD (skip clean files)
 *  - Apply ordered replacements (longest phrases first to avoid partial matches)
 *  - Never touch files outside frontend-src/
 *
 * Idempotent — running it twice produces no further changes.
 */
const fs = require('fs');
const path = require('path');

const FIX = [
  // ── Longest / multi-char phrases first (greedy) ──
  ['Configura��es avan�adas', 'Configurações avançadas'],
  ['Configura��es', 'Configurações'],
  ['Integra��es', 'Integrações'],
  ['integra��es', 'integrações'],
  ['Servi�os', 'Serviços'],
  ['Servi�o', 'Serviço'],
  ['servi�os', 'serviços'],
  ['servi�o', 'serviço'],
  ['prospec��o', 'prospecção'],
  ['Prospec��o', 'Prospecção'],
  ['automa��o', 'automação'],
  ['Automa��o', 'Automação'],
  ['Comunica��o', 'Comunicação'],
  ['comunica��o', 'comunicação'],
  ['Aten��o', 'Atenção'],
  ['aten��o', 'atenção'],
  ['Gera��o', 'Geração'],
  ['gera��o', 'geração'],
  ['op��es', 'opções'],
  ['Op��es', 'Opções'],
  ['op��o', 'opção'],
  ['Op��o', 'Opção'],
  ['informa��es', 'informações'],
  ['Informa��es', 'Informações'],
  ['informa��o', 'informação'],
  ['Informa��o', 'Informação'],
  ['cria��o', 'criação'],
  ['Cria��o', 'Criação'],
  ['otimiza��o', 'otimização'],
  ['Otimiza��o', 'Otimização'],
  ['aplica��o', 'aplicação'],
  ['Aplica��o', 'Aplicação'],
  ['descri��o', 'descrição'],
  ['Descri��o', 'Descrição'],
  ['quest�es', 'questões'],
  ['Quest�es', 'Questões'],
  ['quest�o', 'questão'],
  ['Quest�o', 'Questão'],
  ['sele��o', 'seleção'],
  ['Sele��o', 'Seleção'],
  ['solu��o', 'solução'],
  ['Solu��o', 'Solução'],
  ['situa��o', 'situação'],
  ['Situa��o', 'Situação'],
  ['conex�o', 'conexão'],
  ['Conex�o', 'Conexão'],
  ['conex�es', 'conexões'],
  ['rela��o', 'relação'],
  ['Rela��o', 'Relação'],
  ['rela��es', 'relações'],
  ['orienta��es', 'orientações'],
  ['Orienta��es', 'Orientações'],
  ['publica��o', 'publicação'],
  ['Publica��o', 'Publicação'],
  ['identifica��o', 'identificação'],
  ['Identifica��o', 'Identificação'],
  ['investiga��o', 'investigação'],
  ['Investiga��o', 'Investigação'],
  ['promo��o', 'promoção'],
  ['Promo��o', 'Promoção'],
  ['emo��o', 'emoção'],
  ['Emo��o', 'Emoção'],
  ['emo��es', 'emoções'],
  ['fun��o', 'função'],
  ['Fun��o', 'Função'],
  ['fun��es', 'funções'],
  ['Fun��es', 'Funções'],
  ['orienta��o', 'orientação'],
  ['Orienta��o', 'Orientação'],
  ['atualiza��o', 'atualização'],
  ['Atualiza��o', 'Atualização'],
  ['cancela��o', 'cancelamento'],
  ['Cancela��o', 'Cancelamento'],
  ['inscri��o', 'inscrição'],
  ['Inscri��o', 'Inscrição'],

  // ── ç at word boundaries ──
  ['for�a', 'força'],
  ['For�a', 'Força'],
  ['confian�a', 'confiança'],
  ['Confian�a', 'Confiança'],
  ['mudan�as', 'mudanças'],
  ['mudan�a', 'mudança'],

  // ── é mid-word ──
  ['cr�ditos', 'créditos'],
  ['Cr�ditos', 'Créditos'],
  ['cr�dito', 'crédito'],
  ['Cr�dito', 'Crédito'],
  ['estrat�gia', 'estratégia'],
  ['Estrat�gia', 'Estratégia'],
  ['estrat�gias', 'estratégias'],
  ['estrat�gico', 'estratégico'],
  ['Estrat�gico', 'Estratégico'],
  ['estrat�gica', 'estratégica'],
  ['relat�rio', 'relatório'],
  ['Relat�rio', 'Relatório'],
  ['relat�rios', 'relatórios'],
  ['Relat�rios', 'Relatórios'],
  ['crit�rios', 'critérios'],
  ['crit�rio', 'critério'],
  ['m�trica', 'métrica'],
  ['M�trica', 'Métrica'],
  ['m�tricas', 'métricas'],
  ['M�tricas', 'Métricas'],
  ['m�todo', 'método'],
  ['M�todo', 'Método'],
  ['m�todos', 'métodos'],
  ['M�todos', 'Métodos'],

  // ── á / í / ó / ú / â / ê / ô / ã / õ ──
  ['p�gina', 'página'],
  ['P�gina', 'Página'],
  ['p�ginas', 'páginas'],
  ['P�ginas', 'Páginas'],
  ['caracter�stica', 'característica'],
  ['caracter�sticas', 'características'],
  ['m�dia', 'média'],
  ['M�dia', 'Média'],
  ['m�dias', 'médias'],
  ['par�metro', 'parâmetro'],
  ['Par�metro', 'Parâmetro'],
  ['par�metros', 'parâmetros'],
  ['din�mico', 'dinâmico'],
  ['Din�mico', 'Dinâmico'],
  ['din�mica', 'dinâmica'],
  ['Din�mica', 'Dinâmica'],
  ['din�micas', 'dinâmicas'],
  ['din�micos', 'dinâmicos'],
  ['t�picos', 'tópicos'],
  ['T�picos', 'Tópicos'],
  ['t�pico', 'tópico'],
  ['T�pico', 'Tópico'],
  ['c�digo', 'código'],
  ['C�digo', 'Código'],
  ['c�digos', 'códigos'],

  // ── ã ──
  ['n�o', 'não'],
  ['N�o', 'Não'],
  ['s�o', 'são'],
  ['S�o', 'São'],
  ['est�o', 'estão'],
  ['Est�o', 'Estão'],
  ['m�o', 'mão'],
  ['m�os', 'mãos'],
  ['M�os', 'Mãos'],

  // ── á at end / future tense ──
  ['ir� ', 'irá '],
  ['Ir� ', 'Irá '],
  ['ser� ', 'será '],
  ['Ser� ', 'Será '],
  ['ter� ', 'terá '],
  ['Ter� ', 'Terá '],
  ['far� ', 'fará '],
  ['Far� ', 'Fará '],
  ['est� ', 'está '],
  ['Est� ', 'Está '],
  ['j� ', 'já '],
  ['J� ', 'Já '],
  ['at� ', 'até '],
  ['At� ', 'Até '],

  // ── Common pronouns / determiners ──
  ['voc�', 'você'],
  ['Voc�', 'Você'],
  ['n�s', 'nós'],
  ['N�s', 'Nós'],

  // ── ê ──
  ['m�s', 'mês'],
  ['M�s', 'Mês'],
  ['ingl�s', 'inglês'],
  ['Ingl�s', 'Inglês'],
  ['portugu�s', 'português'],
  ['Portugu�s', 'Português'],
  ['conhec�-lo', 'conhecê-lo'],
  ['conhec�-la', 'conhecê-la'],

  // ── í ──
  ['v�deo', 'vídeo'],
  ['V�deo', 'Vídeo'],
  ['v�deos', 'vídeos'],
  ['V�deos', 'Vídeos'],
  ['n�vel', 'nível'],
  ['N�vel', 'Nível'],
  ['n�veis', 'níveis'],
  ['m�nimo', 'mínimo'],
  ['M�nimo', 'Mínimo'],
  ['m�nima', 'mínima'],
  ['m�ximo', 'máximo'],
  ['M�ximo', 'Máximo'],
  ['m�xima', 'máxima'],
  ['per�odo', 'período'],
  ['Per�odo', 'Período'],
  ['per�odos', 'períodos'],

  // ── ó ──
  ['m�vel', 'móvel'],
  ['M�vel', 'Móvel'],
  ['m�veis', 'móveis'],
  ['p�s', 'pós'],
  ['P�s', 'Pós'],
  ['ap�s', 'após'],
  ['Ap�s', 'Após'],
  ['pr�ximo', 'próximo'],
  ['Pr�ximo', 'Próximo'],
  ['pr�xima', 'próxima'],
  ['Pr�xima', 'Próxima'],
  ['pr�ximas', 'próximas'],
  ['pr�ximos', 'próximos'],
  ['pr�-', 'pré-'],
  ['Pr�-', 'Pré-'],

  // ── ú / ü / í ──
  ['�ltimo', 'último'],
  ['�ltima', 'última'],
  ['�nico', 'único'],
  ['�nica', 'única'],
  ['�timo', 'ótimo'],
  ['�tima', 'ótima'],
  ['�gua', 'água'],
  ['�reas', 'áreas'],
  ['�rea', 'área'],
  ['�cone', 'ícone'],
  ['�cones', 'ícones'],

  // ── Conteúdo / Usuário / Disponível / Responsável / Mensagem / Botão ──
  ['conte�do', 'conteúdo'],
  ['Conte�do', 'Conteúdo'],
  ['conte�dos', 'conteúdos'],
  ['Conte�dos', 'Conteúdos'],
  ['usu�rio', 'usuário'],
  ['Usu�rio', 'Usuário'],
  ['usu�rios', 'usuários'],
  ['Usu�rios', 'Usuários'],
  ['dispon�vel', 'disponível'],
  ['Dispon�vel', 'Disponível'],
  ['dispon�veis', 'disponíveis'],
  ['Dispon�veis', 'Disponíveis'],
  ['indispon�vel', 'indisponível'],
  ['respons�vel', 'responsável'],
  ['Respons�vel', 'Responsável'],
  ['respons�veis', 'responsáveis'],
  ['mensagem', 'mensagem'],
  ['bot�o', 'botão'],
  ['Bot�o', 'Botão'],
  ['bot�es', 'botões'],

  // ── ões — common endings ──
  ['Vis�o', 'Visão'],
  ['vis�o', 'visão'],
  ['Raz�o', 'Razão'],
  ['raz�o', 'razão'],
  ['raz�es', 'razões'],
  ['Miss�o', 'Missão'],
  ['miss�o', 'missão'],
  ['Decis�o', 'Decisão'],
  ['decis�o', 'decisão'],
  ['decis�es', 'decisões'],
  ['Vers�o', 'Versão'],
  ['vers�o', 'versão'],
  ['vers�es', 'versões'],
  ['Regi�o', 'Região'],
  ['regi�o', 'região'],
  ['regi�es', 'regiões'],
  ['Discuss�o', 'Discussão'],
  ['discuss�o', 'discussão'],
  ['Express�o', 'Expressão'],
  ['express�o', 'expressão'],

  // ── B/T/M-leading basic adjectives ──
  ['b�sico', 'básico'],
  ['B�sico', 'Básico'],
  ['b�sica', 'básica'],
  ['t�cnico', 'técnico'],
  ['T�cnico', 'Técnico'],
  ['t�cnica', 'técnica'],

  // ── Análise / Anúncios ──
  ['an�lise', 'análise'],
  ['An�lise', 'Análise'],
  ['an�lises', 'análises'],
  ['an�ncios', 'anúncios'],
  ['An�ncios', 'Anúncios'],
  ['an�ncio', 'anúncio'],

  // ── Round 2: remaining specific words ──
  ['Hist�rico', 'Histórico'],
  ['hist�rico', 'histórico'],
  ['hist�ria', 'história'],
  ['pontua��o', 'pontuação'],
  ['Pontua��o', 'Pontuação'],
  ['pontua��es', 'pontuações'],
  ['presen�a', 'presença'],
  ['Presen�a', 'Presença'],
  ['calend�rio', 'calendário'],
  ['Calend�rio', 'Calendário'],
  ['integra��o', 'integração'],
  ['Integra��o', 'Integração'],
  ['ser�o', 'serão'],
  ['Ser�o', 'Serão'],
  ['gr�tis', 'grátis'],
  ['Gr�tis', 'Grátis'],
  ['cart�o', 'cartão'],
  ['Cart�o', 'Cartão'],
  ['cart�es', 'cartões'],
  ['Fa�a', 'Faça'],
  ['fa�a', 'faça'],
  ['come�ar', 'começar'],
  ['Come�ar', 'Começar'],
  ['come�o', 'começo'],
  ['localiza��o', 'localização'],
  ['Localiza��o', 'Localização'],
  ['or�amento', 'orçamento'],
  ['Or�amento', 'Orçamento'],
  ['r�pidas', 'rápidas'],
  ['R�pidas', 'Rápidas'],
  ['r�pido', 'rápido'],
  ['R�pido', 'Rápido'],
  ['r�pida', 'rápida'],
  ['R�pida', 'Rápida'],
  ['Condi��es', 'Condições'],
  ['condi��es', 'condições'],
  ['condi��o', 'condição'],
  ['ramifica��o', 'ramificação'],
  ['ramifica��es', 'ramificações'],
  ['m�ltiplos', 'múltiplos'],
  ['M�ltiplos', 'Múltiplos'],
  ['m�ltiplas', 'múltiplas'],
  ['M�ltiplas', 'Múltiplas'],
  ['visualiza��o', 'visualização'],
  ['Visualiza��o', 'Visualização'],
  ['visualiza��es', 'visualizações'],
  ['configura��o', 'configuração'],
  ['Configura��o', 'Configuração'],
  ['Documenta��o', 'Documentação'],
  ['documenta��o', 'documentação'],
  ['intelig�ncia', 'inteligência'],
  ['Intelig�ncia', 'Inteligência'],
  ['necess�rio', 'necessário'],
  ['Necess�rio', 'Necessário'],
  ['necess�ria', 'necessária'],
  ['Necess�ria', 'Necessária'],
  ['Intermedi�rio', 'Intermediário'],
  ['intermedi�rio', 'intermediário'],
  ['renova��o', 'renovação'],
  ['Renova��o', 'Renovação'],
  ['avan�ados', 'avançados'],
  ['Avan�ados', 'Avançados'],
  ['avan�ado', 'avançado'],
  ['Avan�ado', 'Avançado'],
  ['avan�ada', 'avançada'],
  ['Avan�ada', 'Avançada'],
  ['avan�adas', 'avançadas'],
  ['V�lido', 'Válido'],
  ['v�lido', 'válido'],
  ['v�lida', 'válida'],
  ['inclu�dos', 'incluídos'],
  ['inclu�das', 'incluídas'],
  ['inclu�do', 'incluído'],
  ['inclu�da', 'incluída'],
  ['transa��o', 'transação'],
  ['transa��es', 'transações'],
  ['Refer�ncia', 'Referência'],
  ['refer�ncia', 'referência'],
  ['Refer�ncias', 'Referências'],
  ['refer�ncias', 'referências'],
  ['sequ�ncia', 'sequência'],
  ['Sequ�ncia', 'Sequência'],
  ['sequ�ncias', 'sequências'],
  ['Est�ticas', 'Estáticas'],
  ['est�tica', 'estática'],
  ['est�tico', 'estático'],
  ['�til', 'útil'],
  ['�teis', 'úteis'],
  ['L�gica', 'Lógica'],
  ['l�gica', 'lógica'],
  ['reuni�o', 'reunião'],
  ['Reuni�o', 'Reunião'],
  ['reuni�es', 'reuniões'],
  ['configur�-lo', 'configurá-lo'],
  ['edit�-lo', 'editá-lo'],
  ['edit�-la', 'editá-la'],
  ['public�-los', 'publicá-los'],
  ['public�-las', 'publicá-las'],
  ['di�ria', 'diária'],
  ['di�rio', 'diário'],
  ['sugest�es', 'sugestões'],
  ['Sugest�es', 'Sugestões'],
  ['sugest�o', 'sugestão'],
  ['espec�fico', 'específico'],
  ['Espec�fico', 'Específico'],
  ['espec�fica', 'específica'],
  ['recomenda��o', 'recomendação'],
  ['Recomenda��o', 'Recomendação'],
  ['recomenda��es', 'recomendações'],
  ['Recomenda��es', 'Recomendações'],
  ['M�dio', 'Médio'],
  ['m�dio', 'médio'],
  ['t�tulo', 'título'],
  ['T�tulo', 'Título'],
  ['t�tulos', 'títulos'],
  ['T�tulos', 'Títulos'],

  // ── Generic "�o" → "ão" and "�es" → "ões" / "ões"
  // These are catch-alls — apply AFTER all specific words above so we don't
  // overwrite e.g. 'foco' or other unrelated tokens.
  // (Most '�o' in Portuguese text is 'ão', most '�es' is 'ões')
  // Restricted to lowercase to avoid false-positives in code identifiers.
  // The script applies in order, so specific words already handled above
  // won't reach these generic rules.

  // ── Standalone � inside words — handle a few common ones ──
  ['ser�', 'será'],
  ['est�', 'está'],
  ['j�', 'já'],
  ['at�', 'até'],
  ['ap�s', 'após'],
  ['p�s', 'pós'],
  ['D�', 'Dê'],

  // ── Final batch (Round 3) ──
  ['p�blico-alvo', 'público-alvo'],
  ['p�blico', 'público'],
  ['P�blico', 'Público'],
  ['instru��o', 'instrução'],
  ['instru��es', 'instruções'],
  ['Instru��es', 'Instruções'],
  ['experi�ncia', 'experiência'],
  ['Experi�ncia', 'Experiência'],
  ['experi�ncias', 'experiências'],
  ['Crit�rios', 'Critérios'],
  ['crit�rios', 'critérios'],
  ['Crit�rio', 'Critério'],
  ['crit�rio', 'critério'],
  ['Amig�vel', 'Amigável'],
  ['amig�vel', 'amigável'],
  ['Qualifica��o', 'Qualificação'],
  ['qualifica��o', 'qualificação'],
  ['hor�rio', 'horário'],
  ['Hor�rio', 'Horário'],
  ['hor�rios', 'horários'],
  ['aprova��o', 'aprovação'],
  ['Aprova��o', 'Aprovação'],
  ['Pre�os', 'Preços'],
  ['pre�os', 'preços'],
  ['Pre�o', 'Preço'],
  ['pre�o', 'preço'],
  ['opera��o', 'operação'],
  ['Opera��o', 'Operação'],
  ['opera��es', 'operações'],
  ['Cen�rio', 'Cenário'],
  ['cen�rio', 'cenário'],
  ['cen�rios', 'cenários'],
  ['Prim�rios', 'Primários'],
  ['prim�rios', 'primários'],
  ['Prim�rio', 'Primário'],
  ['prim�rio', 'primário'],
  ['Prim�ria', 'Primária'],
  ['prim�ria', 'primária'],
  ['Diferencia��o', 'Diferenciação'],
  ['diferencia��o', 'diferenciação'],
  ['Aceita��o', 'Aceitação'],
  ['aceita��o', 'aceitação'],
  ['publicit�rias', 'publicitárias'],
  ['publicit�rios', 'publicitários'],
  ['Aceit�vel', 'Aceitável'],
  ['aceit�vel', 'aceitável'],
  ['Aceit�veis', 'Aceitáveis'],
  ['aplic�veis', 'aplicáveis'],
  ['Aplic�veis', 'Aplicáveis'],
  ['aplic�vel', 'aplicável'],
  ['Aplic�vel', 'Aplicável'],
  ['reembols�veis', 'reembolsáveis'],
  ['reembols�vel', 'reembolsável'],
  ['indica��o', 'indicação'],
  ['Indica��o', 'Indicação'],
  ['indica��es', 'indicações'],
  ['contr�rio', 'contrário'],
  ['Contr�rio', 'Contrário'],
  ['contr�ria', 'contrária'],
  ['anteced�ncia', 'antecedência'],
  ['mant�m', 'mantém'],
  ['Mant�m', 'Mantém'],
  ['adequa��o', 'adequação'],
  ['Adequa��o', 'Adequação'],
  ['tamb�m', 'também'],
  ['Tamb�m', 'Também'],
  ['Pol�tica', 'Política'],
  ['pol�tica', 'política'],
  ['Pol�ticas', 'Políticas'],
  ['pol�ticas', 'políticas'],
  ['pol�tico', 'político'],
  ['Pol�tico', 'Político'],
  ['Limita��es', 'Limitações'],
  ['limita��es', 'limitações'],
  ['Limita��o', 'Limitação'],
  ['limita��o', 'limitação'],
  ['exceder�', 'excederá'],
  ['Exceder�', 'Excederá'],
  ['cessar�', 'cessará'],
  ['ret�-los', 'retê-los'],
  ['ret�-las', 'retê-las'],
  ['Altera��o', 'Alteração'],
  ['altera��o', 'alteração'],
  ['Altera��es', 'Alterações'],
  ['altera��es', 'alterações'],
  ['notifica��o', 'notificação'],
  ['Notifica��o', 'Notificação'],
  ['notifica��es', 'notificações'],
  ['d�vidas', 'dúvidas'],
  ['D�vidas', 'Dúvidas'],
  ['d�vida', 'dúvida'],
  ['D�vida', 'Dúvida'],
  ['navega��o', 'navegação'],
  ['Navega��o', 'Navegação'],
  ['otimiza��es', 'otimizações'],
  ['Otimiza��es', 'Otimizações'],
  ['Condi��o', 'Condição'],
  ['condi��o', 'condição'],
  ['se��o', 'seção'],
  ['Se��o', 'Seção'],
  ['se��es', 'seções'],
  ['Se��es', 'Seções'],
  ['v� ', 'vê '],
  ['V� ', 'Vê '],
  ['n� ', 'nó '],
  ['N� ', 'Nó '],
];

let totalFiles = 0, totalReplacements = 0;

function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === 'node_modules' || item.name === 'dist' || item.name === '.git') continue;
      walk(full);
    } else if (/\.(jsx?|tsx?|md|html)$/i.test(item.name)) {
      let text;
      try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
      if (!text.includes('�')) continue;
      const original = text;
      let localCount = 0;
      for (const [from, to] of FIX) {
        if (!text.includes(from)) continue;
        const parts = text.split(from);
        localCount += parts.length - 1;
        text = parts.join(to);
      }
      if (text !== original) {
        fs.writeFileSync(full, text, 'utf8');
        totalFiles++;
        totalReplacements += localCount;
        const rel = path.relative(process.cwd(), full);
        console.log(`Fixed (${localCount}): ${rel}`);
      }
    }
  }
}

/**
 * Generic-regex fallback pass. Applied AFTER the literal FIX table on each
 * file. These are statistically the most common Portuguese letter patterns
 * that survived. Restricted to lowercase-letter-context to avoid touching
 * code identifiers.
 */
function regexFallback(text) {
  // `\w�o` ending mid-word → likely 'ão'  (e.g. "lan�o" → "lanço"? no — "ão")
  // We're conservative: only apply when preceded by a letter and followed by
  // a non-letter boundary (or another letter like the 'o' continuation).
  text = text.replace(/(?<=[a-z])�o\b/g, 'ão');
  text = text.replace(/(?<=[a-z])�es\b/g, 'ões');
  // 'ç' patterns common: lan�a, faç, mu�a, prec, etc.
  text = text.replace(/(?<=[a-z])�a\b/g, 'ça');
  // Final orphan � between a letter and an o/a — likely á/é/ó
  // Keep this minimal — apply only in obvious word-mid positions
  // to avoid breaking valid file contents.
  return text;
}

// Patch walk() to apply regex fallback after literal replacements
const origReadFile = fs.readFileSync.bind(fs);
const origWriteFile = fs.writeFileSync.bind(fs);

function walkV2(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(item.name)) continue;
      walkV2(full);
    } else if (/\.(jsx?|tsx?|md|html)$/i.test(item.name)) {
      let text;
      try { text = origReadFile(full, 'utf8'); } catch { continue; }
      if (!text.includes('�')) continue;
      const original = text;
      let local = 0;
      for (const [from, to] of FIX) {
        if (!text.includes(from)) continue;
        const parts = text.split(from);
        local += parts.length - 1;
        text = parts.join(to);
      }
      // Generic fallback
      const beforeRx = text;
      text = regexFallback(text);
      if (text !== beforeRx) local += (beforeRx.length - text.length) / 2;
      if (text !== original) {
        origWriteFile(full, text, 'utf8');
        totalFiles++;
        totalReplacements += local;
        console.log(`Fixed (${local}): ${path.relative(process.cwd(), full)}`);
      }
    }
  }
}

// Use the v2 walker that includes regex fallback
walk = walkV2;
walk('frontend-src');
console.log('---');
console.log(`Files modified: ${totalFiles}`);
console.log(`Replacements applied: ${totalReplacements}`);

// Report any remaining replacement chars
let remaining = 0;
function check(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === 'node_modules' || item.name === 'dist' || item.name === '.git') continue;
      check(full);
    } else if (/\.(jsx?|tsx?|md|html)$/i.test(item.name)) {
      const t = fs.readFileSync(full, 'utf8');
      const count = (t.match(/�/g) || []).length;
      if (count > 0) {
        remaining += count;
        console.log(`STILL HAS ${count}: ${path.relative(process.cwd(), full)}`);
      }
    }
  }
}
check('frontend-src');
console.log(`Remaining replacement chars across project: ${remaining}`);
