import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const MOCK_ENV = {
    FIREBASE_CONFIG: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    },
    MERCADOPAGO_APP_ID: import.meta.env.VITE_MERCADOPAGO_APP_ID,
    MERCADOPAGO_ACCESS_TOKEN: import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN,
    MERCADOPAGO_REDIRECT_URI: import.meta.env.VITE_MERCADOPAGO_REDIRECT_URI
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : MOCK_ENV.FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, MOCK_ENV };
