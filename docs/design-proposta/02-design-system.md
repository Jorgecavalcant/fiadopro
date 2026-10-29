# Design system proposto

Um visual só, no site e no Android. Os tokens estão em `tokens.css`. As classes de exemplo estão em `prototipos/app.css`. Nada disso foi ligado ao app.

Contraste medido em 29/10/2026. Texto normal precisa de 4,5:1.

## Cor

| Token | Hex | Uso | Contraste medido |
|---|---|---|---|
| `--fp-navy` | `#1C2446` | Texto, botão primário, navegação | 15,11:1 com branco |
| `--fp-bg` | `#F4F6FB` | Fundo da página | 13,97:1 com o navy |
| `--fp-surface` | `#FFFFFF` | Cartão | — |
| `--fp-line` | `#D5DCEC` | Borda | não usar como texto |
| `--fp-muted` | `#3E4C6E` | Legenda | 8,52:1 no branco |
| `--fp-receive` | `#065F46` | Botão de receber pagamento | 7,68:1 com branco |
| `--fp-danger` | `#B91C1C` | Excluir, bloquear | 6,47:1 com branco |
| `--fp-owe-text` / `--fp-owe-bg` | `#9F1239` / `#FFF1F2` | Te deve | 7,30:1 |
| `--fp-credit-text` / `--fp-credit-bg` | `#065F46` / `#ECFDF5` | Você deve | 7,29:1 |
| `--fp-even-text` / `--fp-even-bg` | `#1C2446` / `#EEF2FF` | Em dia | 13,51:1 |

O cinza `#94A3B8` sai do texto. Ele mede 2,56:1 no branco.

Alertas:

| Tipo | Fundo | Borda | Texto | Contraste |
|---|---|---|---|---|
| Sucesso | `#ECFDF5` | `#047857` | `#064E3B` | 9,23:1 |
| Aviso | `#FFFBEB` | `#B45309` | `#1C2446`, valor `#92400E` | 14,57:1 e 6,84:1 |
| Erro | `#FEF2F2` | `#B91C1C` | `#7F1D1D` | 9,16:1 |
| Info | `#EEF2FF` | `#1C2446` | `#1C2446` | 13,51:1 |

## Tipo e tamanho

Fonte: Inter, com Segoe UI ou a fonte do sistema se a Inter não carregar.

| Papel | Tamanho | Peso |
|---|---|---|
| Título de tela | 28px no desktop, 20px no topo do celular | 800 |
| Seção | 22px | 800 |
| Corpo e campo | 16px | 400 a 700 |
| Apoio | 14px | 600 |
| Rótulo | 12px, caixa alta, espaçamento 0,04em | 700 |

Não usar 10px. Não usar peso 900 em tudo. Campo com altura mínima de 48px, para o dedo e para o celular não dar zoom.

## Peças

**Botão primário.** Fundo navy, texto branco, altura mínima 48px, largura 100% no celular, texto que quebra em palavras inteiras.

**Botão de receber.** Só para Registrar pagamento. Verde `#065F46`. É o único verde de ação.

**Botão secundário.** Fundo branco, borda e texto navy. Abatimento, Devolução, voltar, ação alternativa.

**Botão de perigo.** Fundo `#B91C1C`, texto branco. Excluir e bloquear. Não usar para saldo.

**Cartão.** Fundo branco, borda `#D5DCEC`, raio 16px, padding 16px.

**Saldo.** Um componente só.

- Te deve: fundo rosa, texto `#9F1239`, frase "Te deve R$ 350,00".
- Você deve: fundo verde claro, texto `#065F46`, frase "Você deve R$ 425,00".
- Em dia: fundo azul claro, texto navy, frase "Em dia".

**Alerta.** Largura total, ícone ou título em uma linha, texto embaixo, sem botão dentro. O aviso de saldo credor usa o alerta âmbar: título "Você deve R$ 425,00 a este cliente" e uma frase apontando Devolução ou Abatimento.

**Campo.** Rótulo 14px, caixa 48px, erro embaixo em `#7F1D1D`. Data sempre dd/mm/aaaa. Moeda sempre R$ 1.000,00 na tela e número no envio.

**Ícone.** 20px, alinhado ao texto, sem círculo de 56px competindo com o título.

**Espaço.** Grade de 8px. Entre blocos, 16px. Nada de 32px num aviso e 8px no vizinho.

## Tailwind, para aplicar depois

```js
// trecho para o theme, quando a PR de tokens for aprovada
colors: {
  fp: {
    navy: '#1C2446',
    bg: '#F4F6FB',
    line: '#D5DCEC',
    muted: '#3E4C6E',
    receive: '#065F46',
    danger: '#B91C1C',
    owe: '#9F1239',
    oweBg: '#FFF1F2',
    credit: '#065F46',
    creditBg: '#ECFDF5',
  },
},
borderRadius: { fp: '12px', fpCard: '16px' },
fontSize: { caption: ['12px', '1.3'] },
minHeight: { control: '48px' },
```

O arquivo que vale é o `tokens.css`. O trecho acima só traduz os mesmos números.
