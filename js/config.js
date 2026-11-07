// Configuração pública do MY LIFE. Nada aqui é secreto: quem protege os dados
// são as regras do Firestore e a criptografia feita no navegador.
export const FIREBASE = {
  apiKey: "AIzaSyDK9zCszaObQMJJGnTkSTGqGjPYjJvq_eE",
  authDomain: "my-life-b4f17.firebaseapp.com",
  projectId: "my-life-b4f17",
  storageBucket: "my-life-b4f17.firebasestorage.app",
  messagingSenderId: "323203268453",
  appId: "1:323203268453:web:ff3f68b7431094c145ab8c"
};

// ID do cliente OAuth do Google (somente leitura da agenda).
export const GOOGLE_CLIENT_ID = "323203268453-l09j4aqa9lhpsp3j8ub5biho0r2sk6so.apps.googleusercontent.com";
export const GOOGLE_ESCOPOS = "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly";

// Endereço do app (usado nos links dos e-mails de confirmação e de nova senha).
export const APP_URL = location.origin + location.pathname.replace(/[^/]*$/, "");

export const VERSAO = "1.2.0";
export const ITERACOES_PBKDF2 = 600000; // OWASP Password Storage Cheat Sheet: PBKDF2-HMAC-SHA256 ≥ 600.000
