#!/usr/bin/env node
const fs = require('fs');
const path = 'frontend-src/pages/Pricing.jsx';
let text = fs.readFileSync(path, 'utf8');

const OLD = `      {/* FAQ */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="text-white font-bold text-lg">{isPt ? 'Perguntas Frequentes' : 'Frequently Asked Questions'}</h2>
        {(isPt ? [`;

const NEW = `      {/* FAQ */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="text-white font-bold text-lg">{isPt ? 'Perguntas Frequentes' : 'Frequently Asked Questions'}</h2>
        {(isPt ? [
          ['O que são créditos de IA?', 'Créditos são a moeda interna para operações com IA: geração de emails, scoring de leads, criação de conteúdo, planejamento de campanhas e mais. O consumo é proporcional ao modelo escolhido — modelos mais avançados consomem mais créditos por requisição.'],
          ['O que é um Scan Token?', 'Um Scan Token é uma moeda separada (não é crédito de IA) usada exclusivamente para gerar Brand Scans completos — nosso relatório estratégico premium com inteligência de mercado, análise competitiva e recomendações de posicionamento. Cada plano inclui scan tokens mensais; você pode comprar tokens avulsos por R$ 800 cada.'],
          ['Os créditos e scan tokens são renovados todo mês?', 'Sim. No primeiro dia de cada ciclo mensal de cobrança, seus créditos de IA e scan tokens são restaurados conforme o plano. Add-ons (pacotes de créditos extras ou tokens de Full Scan avulsos) NÃO acumulam — use no ciclo em que foram comprados.'],
          ['Posso cancelar a qualquer momento?', 'Sim. Planos mensais podem ser cancelados a qualquer momento sem taxa — o acesso continua até o fim do mês pago.'],
          ['E se eu cancelar o plano anual antes de 12 meses?', 'Aplicamos uma Taxa de Cancelamento Anual que recupera o desconto de 15% concedido sobre os meses utilizados, e reembolsamos 30% do valor dos meses não usados (descontada a taxa). Exemplo: cancelar o plano Starter Anual no 3º mês resulta em taxa de R$ 36,00 e reembolso líquido de aproximadamente R$ 147,33. Os outros 70% dos meses não usados ficam retidos como taxa de serviço — padrão da indústria para planos anuais.'],
          ['Por que existe taxa de cancelamento no plano anual?', 'O desconto de 15% no plano anual é concedido em troca de um compromisso de 12 meses. Se o cliente cancela antes, recuperamos a parte do desconto aplicada aos meses já utilizados — você essencialmente paga o preço mensal pelos meses que usou, em vez do preço anual com desconto.'],
          ['Existe desconto anual?', 'Sim. Pagamento anual oferece 15% de desconto em relação ao mensal — pago integralmente no início do ciclo.'],
          ['O trial é realmente grátis?', 'Sim. 14 dias com acesso completo a todas as funcionalidades de IA, sem cartão de crédito. Brand Scans não estão incluídos no trial — exigem upgrade para Growth ou superior.'],
        ] : [`;

if (!text.includes(OLD)) {
  console.error('OLD pattern not found — aborting.');
  process.exit(1);
}
text = text.replace(OLD, NEW);

const OLD2 = `        ] : [
          ['What are AI credits?', 'Credits are the internal currency for all AI-powered operations: email generation, lead scoring, content creation, campaign planning, scans and more.'],
          ['What is a Scan Token?', 'A Scan Token unlocks a Full Scan ` + String.fromCharCode(8212) + ` our premium strategic market intelligence report with competitive analysis, positioning, and GTM recommendations.'],
          ['Can I cancel anytime?', 'Yes. Cancel at any time. Your access continues until the end of the paid period.'],
          ['Is there an annual discount?', 'Yes. Annual billing saves you 15% compared to monthly.'],
          ['Is the trial really free?', 'Yes. 14 days with full access, no credit card required.'],`;

const NEW2 = `        ] : [
          ['What are AI credits?', 'Credits are the internal currency for AI operations: email generation, lead scoring, content creation, campaign planning and more. Consumption is proportional to the model used — more advanced models cost more credits per request.'],
          ['What is a Scan Token?', 'A Scan Token is a separate currency (not an AI credit) used exclusively to generate full Brand Scans — our premium strategic market intelligence report with competitive analysis and positioning recommendations. Each plan includes monthly scan tokens; you can buy additional Full Scan tokens for R$ 800 each.'],
          ['Are credits and scan tokens reset every month?', 'Yes. On the first day of each monthly billing cycle, your AI credits and scan tokens are restored according to your plan. Add-ons (extra credit packs or one-off Full Scan tokens) do NOT carry over — use them in the cycle you bought them.'],
          ['Can I cancel anytime?', 'Yes. Monthly plans can be cancelled at any time with no fee — access continues until the end of the paid month.'],
          ['What if I cancel an annual plan before 12 months?', 'An Annual Cancellation Fee applies: we recover the 15% discount given on the months you used, and refund 30% of the unused prepaid months minus that fee. Example: cancelling Starter Annual in month 3 produces a R$ 36.00 fee and a net refund of approximately R$ 147.33. The other 70% of unused months is retained as a service charge — industry standard for annual plans.'],
          ['Why is there a cancellation fee on annual plans?', 'The 15% annual discount is granted in exchange for a 12-month commitment. If a customer cancels early, we recover the portion of the discount applied to the months already consumed — you essentially pay the monthly price for the months you used, instead of the discounted annual price.'],
          ['Is there an annual discount?', 'Yes. Annual billing saves you 15% compared to monthly — paid upfront at the start of the cycle.'],
          ['Is the trial really free?', 'Yes. 14 days with full access to every AI feature, no credit card required. Brand Scans are not included in the trial — they require an upgrade to Growth or higher.'],`;

if (!text.includes(OLD2)) {
  // The em-dash above might not match exactly, try with literal arrow
  const OLD2alt = `        ] : [\n          ['What are AI credits?', 'Credits are the internal currency for all AI-powered operations: email generation, lead scoring, content creation, campaign planning, scans and more.'],\n          ['What is a Scan Token?', 'A Scan Token unlocks a Full Scan — our premium strategic market intelligence report with competitive analysis, positioning, and GTM recommendations.'],\n          ['Can I cancel anytime?', 'Yes. Cancel at any time. Your access continues until the end of the paid period.'],\n          ['Is there an annual discount?', 'Yes. Annual billing saves you 15% compared to monthly.'],\n          ['Is the trial really free?', 'Yes. 14 days with full access, no credit card required.'],`;
  if (text.includes(OLD2alt)) {
    text = text.replace(OLD2alt, NEW2);
  } else {
    console.error('EN block not found — leaving file as-is for that block.');
  }
} else {
  text = text.replace(OLD2, NEW2);
}

fs.writeFileSync(path, text, 'utf8');
console.log('FAQ section rewritten.');
