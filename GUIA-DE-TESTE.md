# MY LIFE — Guia de cadastro e teste

**Endereço do app:** https://tabuchicontato-create.github.io/my-life/

> Se a página ainda mostrar a tela antiga de teste da agenda, espere 2–3 minutos e recarregue com **Ctrl + Shift + R**. O GitHub está publicando a versão nova.

---

## 0. Antes de tudo: um ajuste que só você pode terminar (2 minutos)

Ele faz o link de "Esqueci a senha" abrir o MY LIFE em vez de abrir a página padrão do Firebase.
**Sem esse ajuste, não use "Esqueci a senha".** A página padrão troca a senha do jeito errado e o app deixa de conseguir abrir seu cofre.

1. Abra o **Console do Firebase** → projeto **my-life** → **Authentication** → aba **Modelos**.
2. Clique em **Verificação de endereço de e-mail** e depois no **lápis** (editar).
3. No rodapé da janela, clique em **Personalizar URL de ação**.
4. Cole exatamente: `https://tabuchicontato-create.github.io/my-life/` e clique em **Salvar**.
   O endereço vale para todos os modelos.
5. Ainda em **Modelos**, no canto inferior, troque o **Idioma do modelo** para **Português (Brasil)** e salve.

---

## 1. Cadastro

1. Abra o app e clique em **Criar conta**.
2. Informe seu e-mail.
3. Crie a senha. Pode clicar em **Gerar frase** para usar 6 palavras aleatórias.
   - Anote a senha em papel. **Ninguém consegue recuperá-la por você, nem eu.**
4. O app mostra a **chave de recuperação** (8 blocos de 4 caracteres).
   - Clique em **Imprimir** ou copie e guarde em papel, longe do computador.
   - Digite o último bloco para confirmar que guardou.
5. Abra seu e-mail e clique no link de confirmação. Olhe também o spam.
6. Volte ao app e entre com e-mail e senha.

## 2. Roteiro de teste (marque o que funcionou)

### Finanças
- [ ] Lance uma despesa, por exemplo R$ 35,50 de ração na categoria Pets.
- [ ] Lance uma receita.
- [ ] Ajuste o orçamento mensal e confira se o saldo bate.

### Faculdade
- [ ] Cadastre uma prova e um trabalho com data.
- [ ] Adicione ou remova uma disciplina.

### Agenda
- [ ] Clique em **Conectar Google Agenda** e autorize com sua conta.
  - A permissão é **somente leitura**: o app nunca cria, altera ou apaga eventos.
- [ ] Navegue entre as semanas.
- [ ] Esconda uma agenda que não quer ver.
- [ ] A conexão dura cerca de 1 hora. Depois, clique em **Sincronizar** de novo.

### Saúde
- [ ] Registre um remédio e uma dose.
- [ ] Registre uma consulta, um exame e um sintoma.
- [ ] Registre um treino, uma refeição e a água do dia.

### Assistente
Teste estas frases e confirme cada prévia:
- [ ] `Gastei 80 em roupa`
- [ ] `Recebi 200 de freela`
- [ ] `Tenho prova de Anatomia quinta às 14h`
- [ ] `Quais provas estão chegando?`
- [ ] `Quanto gastei este mês?` e `Qual meu saldo?`
- [ ] `Toda segunda e quarta tenho academia das 7h às 8h`
- [ ] `Quando eu disser padaria do Zé, é Alimentação`
- [ ] `Organize minha semana` e `O que tenho hoje?`
- [ ] `Mostre minha rotina` e `Remover academia`

Perguntas clínicas (doses, diagnóstico) são recusadas de propósito.

### Perfil e segurança
- [ ] Mude o tempo de saída automática e espere a sessão encerrar sozinha.
- [ ] **Exportar backup**: baixe o arquivo `.mylife.json`.
- [ ] Feche e reabra o navegador. O app deve pedir login de novo.
- [ ] No celular, abra o endereço e use **Adicionar à tela inicial**.

### Recuperação (teste só depois de fazer o passo 0 e o backup)
- [ ] Em **Esqueci a senha**, peça o e-mail, crie uma senha nova e informe a chave de recuperação. Seus dados devem continuar lá.

---

## 3. O que anotar para me mandar

Para cada problema, anote:
- a tela;
- o que você fez;
- o que esperava;
- o que aconteceu (um print ajuda).

**Nunca me mande** sua senha, a chave de recuperação ou códigos recebidos por e-mail.

## 4. Depois dos testes (próximos passos)

- Bloquear novos cadastros, para que só você tenha conta.
- Restringir a chave do Firebase ao endereço do app.
- 2FA: ficou para depois, porque exige um upgrade do Firebase.
- Ollama no seu PC.
