# Design system — aprovado em 29/10/2026

Uma cor principal. Fundo claro. Ícone de linha. Texto que cabe em 360px.

O arquivo `tokens.css` desta pasta é a fonte dos protótipos. Ainda não entra no app.

## Cor

| Uso | Valor |
|---|---|
| Principal | `#2B2F77` |
| Fundo suave (círculo do ícone) | `#ECEDF7` |
| Fundo do app | `#F6F6F4` |
| Cartão | `#FFFFFF` |
| Tile | `#EFEFEC` |
| Divisória | `#E6E6E2` |
| Texto | `#1A1A1A` |
| Texto secundário | `#5C5C5C` |
| Entrada / recebido | `#1F7A4D` |
| Atraso / erro | `#B3261E` |
| Aviso, fundo | `#FFF6E5` |
| Aviso, texto | `#5A3A00` |

Cartão: raio 10px, sombra `0 1px 2px rgba(0,0,0,.05)`.

## Contraste medido em 29/10/2026

Texto normal precisa de 4,5:1. Todas as combinações abaixo passam.

| Texto | Fundo | Razão |
|---|---|---|
| `#FFFFFF` | `#2B2F77` | 11,83 |
| `#1A1A1A` | `#F6F6F4` | 16,08 |
| `#1A1A1A` | `#FFFFFF` | 17,40 |
| `#5C5C5C` | `#FFFFFF` | 6,69 |
| `#5C5C5C` | `#F6F6F4` | 6,18 |
| `#5C5C5C` | `#EFEFEC` | 5,80 |
| `#1F7A4D` | `#FFFFFF` | 5,32 |
| `#1F7A4D` | `#F6F6F4` | 4,91 |
| `#B3261E` | `#FFFFFF` | 6,54 |
| `#5A3A00` | `#FFF6E5` | 9,59 |
| `#2B2F77` | `#ECEDF7` | 10,15 |
| `#FFFFFF` | `#1F7A4D` | 5,32 |
| `#B3261E` | `#F8E8E6` (Sair) | 5,50 |

## Tipo

Fonte do sistema: `-apple-system`, Inter, Roboto.

| Papel | Tamanho | Peso |
|---|---|---|
| Valor principal | 28px | 600 |
| Título | 22px | 500 |
| Corpo | 15px | 400 |

## Ícone

SVG de linha, traço 1,5, sem preenchimento, na cor principal. De preferência dentro do círculo `#ECEDF7`.

Proibido: emoji, imagem de banco, ilustração e gradiente.

## Peças

- **Ação rápida.** Pílula preenchida na cor principal, ícone branco, rótulo embaixo, numa linha só.
- **Lista.** Círculo de ícone, título, subtítulo e seta fina. Divisória de 1px.
- **Extrato.** Data pequena em cima, descrição, valor à direita. Entrada em verde. Saída em preto com menos.
- **Detalhe.** Cabeçalho sólido na cor principal, título branco grande, folha clara arredondada por baixo. Aba com sublinhado.
- **Filtro.** Chip em pílula: 7 dias, 15 dias, 30 dias, Outro.
- **Busca.** Campo cinza, arredondado.
- **Navegação.** Quatro itens de contorno: Início, Pessoas, Extrato, Menu. O ativo fica na cor principal.
- **Saldo oculto.** Ícone de olho. No lugar do valor, `••••`.
- **Aviso.** Caixa `#FFF6E5`, texto curto que diz o que fazer. Sem botão cortado.
- **Sair.** Texto `#B3261E` em fundo `#F8E8E6`, no fim do menu.

Nenhum texto ou botão pode cortar em 360px. Conferir também em 390, 768 e 1280px.

## Palavras

A interface diz **Minha conta**, **Pessoas** e **Contatos**. Não diz loja nem lojista. Qualquer pessoa lança o que outros devem a ela ou o que ela deve.
