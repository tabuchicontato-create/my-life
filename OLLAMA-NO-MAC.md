# Ligar o Ollama ao MY LIFE (Mac)

Leva uns 15 minutos, e a maior parte é o download do modelo. É de graça e roda no seu computador.

## 1. Instalar o Ollama
1. Acesse **ollama.com/download**, baixe a versão para **macOS** e instale. Arraste para a pasta Aplicativos.
2. Abra o **Ollama**. Aparece um ícone de lhama na barra de menus, lá em cima.

## 2. Baixar o modelo
1. Abra o **Terminal**: aperte Cmd + Espaço, digite "Terminal" e aperte Enter.
2. Cole o comando abaixo e aperte Enter. O download tem cerca de 2 GB.
   ```
   ollama pull qwen2.5:3b
   ```
3. Espere até aparecer **success**.

## 3. Permitir que o MY LIFE fale com o Ollama
Por segurança, o Ollama só aceita pedidos de sites que você autorizar.

1. Ainda no Terminal, cole e aperte Enter:
   ```
   launchctl setenv OLLAMA_ORIGINS "https://tabuchicontato-create.github.io"
   ```
2. Feche o Ollama: clique no ícone da lhama e escolha **Quit Ollama**. Depois abra o Ollama de novo.

**Para não precisar repetir depois de reiniciar o Mac**, cole este bloco inteiro no Terminal uma única vez:
```
mkdir -p ~/Library/LaunchAgents && cat > ~/Library/LaunchAgents/mylife.ollama.origins.plist <<'FIM'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>mylife.ollama.origins</string>
<key>ProgramArguments</key><array><string>launchctl</string><string>setenv</string><string>OLLAMA_ORIGINS</string><string>https://tabuchicontato-create.github.io</string></array>
<key>RunAtLoad</key><true/>
</dict></plist>
FIM
launchctl load ~/Library/LaunchAgents/mylife.ollama.origins.plist
```

## 4. Ligar no app
1. Abra o MY LIFE **no Chrome do Mac**. O Safari pode bloquear a conexão com o Ollama.
2. Vá em **Perfil → IA local (Ollama)**.
3. Marque **"Usar o Ollama quando o assistente não entender"** e clique em **Salvar**.
4. Clique em **Testar conexão**.
   - Se o Chrome perguntar se o site pode **acessar dispositivos da rede local**, clique em **Permitir**.
   - O app deve mostrar: *"Conectado. Modelo qwen2.5:3b encontrado."*

## 5. Testar no Assistente
Escreva do seu jeito, por exemplo:
- `fui no mercado e deixei 30 conto, depois peguei um uber de 15`. Devem aparecer 2 prévias.
- `semana que vem tenho prova de histologia na terça às 10`
- `de segunda a sexta eu malho das 6 às 7`

A primeira resposta pode demorar uns 20 segundos, enquanto o modelo carrega. Depois disso fica mais rápido. Nada é salvo sem você clicar em **Confirmar**.

## Como funciona e o que fica protegido
- Primeiro, as regras do próprio app tentam entender a frase. O Ollama só é chamado quando elas não entendem.
- O Ollama apenas transforma a frase em comandos que o app já conhece.
- A frase vai só até o seu computador, nunca para a internet.
- **Assuntos de saúde nunca são enviados para a IA.** Remédio, dose, sintoma, consulta, exame e similares são barrados antes.
- O Ollama não tem acesso aos seus dados: recebe só a frase, a data de hoje, as categorias, as disciplinas e os seus termos.
- Ele só funciona no Mac, com o Ollama aberto. No celular, deixe a opção desligada. O assistente continua funcionando com as regras normais.

## Se der problema
| Mensagem | O que fazer |
|---|---|
| "Não consegui falar com o Ollama" | Confira se a lhama está na barra de menus e refaça o passo 3, fechando e abrindo o Ollama. |
| "modelo … não está instalado" | Rode `ollama pull qwen2.5:3b` no Terminal. |
| Respostas lentas ou ruins | Mac com 16 GB de RAM ou mais: troque o modelo para `qwen2.5:7b`. Rode `ollama pull qwen2.5:7b` e mude o nome em Perfil. |
