'use client'

// =============================================================
// Inicialização do Firebase (SDK web, lado do cliente).
// Estes valores são PÚBLICOS por design: não são segredo.
// A segurança mora nas Regras do Firestore (firestore.rules).
// =============================================================
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getFunctions, type Functions } from 'firebase/functions'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export function configurado(): boolean {
  return Boolean(config.apiKey && config.projectId)
}

/** Config pública (usada para criar um app secundário ao convidar usuários). */
export const firebaseConfig = config

let app: FirebaseApp | undefined
let _db: Firestore | undefined
let _auth: Auth | undefined
let _storage: FirebaseStorage | undefined
let _funcoes: Functions | undefined

function appFirebase(): FirebaseApp {
  if (!app) app = getApps().length ? getApp() : initializeApp(config as Record<string, string>)
  return app
}

export function db(): Firestore {
  if (!_db) _db = getFirestore(appFirebase())
  return _db
}

export function auth(): Auth {
  if (!_auth) _auth = getAuth(appFirebase())
  return _auth
}

/** Firebase Storage (uploads de vídeo/foto/arquivo das Informações Administrativas). */
export function storage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(appFirebase())
  return _storage
}

/** Cloud Functions (mesma região das functions: southamerica-east1).
 *  Usado pelo painel de e-mail para chamar a função de teste de envio. */
export function funcoes(): Functions {
  if (!_funcoes) _funcoes = getFunctions(appFirebase(), 'southamerica-east1')
  return _funcoes
}
