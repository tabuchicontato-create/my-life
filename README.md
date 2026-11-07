# MY LIFE

Organizador pessoal (PWA): finanças, faculdade, agenda (Google, somente leitura), saúde, assistente e backup.

- **Endereço:** https://tabuchicontato-create.github.io/my-life/
- **Dados:** Firebase (Auth + Firestore, São Paulo). Tudo que é pessoal é cifrado no navegador (AES-GCM 256) antes de sair do aparelho.
- **Senha:** PBKDF2-HMAC-SHA256, 600.000 iterações (recomendação OWASP). O Firebase só recebe uma senha derivada; a chave que abre os dados nunca sai do navegador.
- **Chave de recuperação:** impressa no cadastro. Sem ela, redefinir a senha cria um cofre novo e os dados antigos ficam bloqueados.
- **Regras do banco:** `firestore.rules`, testadas em `testes/` pelo GitHub Actions (cada usuária só acessa os próprios dados; texto puro é recusado).

Nada secreto fica neste repositório: a configuração do Firebase e o ID do cliente Google são públicos por natureza.
