import React from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection, query, getDoc, writeBatch } from 'firebase/firestore';
import Header from './components/Header';
import Spinner from './components/Spinner';
import HomePage from './components/HomePage';
import CreateRafflePage from './components/CreateRafflePage';
import ProfilePage from './components/ProfilePage';
import RaffleDetailPage from './components/RaffleDetailPage';

// --- INSTRUCCIONES DE CONFIGURACIÓN ---
// 1. CREA UN PROYECTO EN FIREBASE:
//    - Ve a https://console.firebase.google.com/
//    - Crea un nuevo proyecto.
//    - Ve a "Authentication" -> "Sign-in method" y habilita "Google" y "Anonymous".
//    - Ve a "Firestore Database" y crea una base de datos en modo de prueba (luego podrás ajustar las reglas de seguridad).
//
// 2. OBTÉN LAS CREDENCIALES DE FIREBASE:
//    - En la configuración de tu proyecto de Firebase, ve a "Project settings".
//    - En la sección "Your apps", crea una nueva "Web app".
//    - Copia el objeto `firebaseConfig` que te proporcionará Firebase.
//
// 3. CREA UNA APLICACIÓN EN MERCADO PAGO:
//    - Ve a https://www.mercadopago.com/developers/
//    - Inicia sesión y ve a "Tus aplicaciones".
//    - Crea una nueva aplicación.
//    - En la configuración de la aplicación, necesitarás:
//      - ACCESS TOKEN: Lo usarás en tu backend.
//      - PUBLIC KEY: La usarás en el frontend.
//      - REDIRECT URI: Configura esta URL a la página donde los usuarios volverán después de conectar su cuenta. Para pruebas locales, puede ser http://localhost:3000/profile. Para producción, será la URL de tu app.
//      - WEBHOOKS: Configura una URL de notificación para recibir los pagos. En un entorno real, sería una URL de tu backend (ej: https://tu-api.com/webhooks/mercadopago).

// --- IMPORTANTE: REGLAS DE SEGURIDAD DE FIRESTORE ---
// El error "Missing or insufficient permissions" se debe a las reglas de seguridad de tu base de datos Firestore.
// Para que esta aplicación funcione correctamente, necesitas actualizar tus reglas en la consola de Firebase -> Firestore Database -> Rules.
// Copia y pega las siguientes reglas. Estas permiten que CUALQUIERA vea las rifas, pero solo los usuarios autenticados pueden crear o comprar.
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cualquiera puede leer la lista de rifas y los tickets
    match /raffles/{raffleId}/{document=**} {
      allow read: if true;
    }

    // Para crear una rifa, debes estar autenticado y ser el dueño
    match /raffles/{raffleId} {
      allow create: if request.auth != null && request.resource.data.organizerId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.organizerId == request.auth.uid;
    }

    // Los usuarios solo pueden modificar su propio perfil
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Los usuarios autenticados pueden crear y gestionar sus propias órdenes
    match /orders/{orderId} {
        allow create: if request.auth != null && request.resource.data.buyerId == request.auth.uid;
        allow read, update: if request.auth != null && resource.data.buyerId == request.auth.uid;
    }
  }
}
*/

// --- SIMULACIÓN DE VARIABLES DE ENTORNO ---
// Ahora se importa desde ./firebase.js

// --- INICIALIZACIÓN DE FIREBASE ---
// Ahora se importa desde ./firebase.js

// --- COMPONENTE PRINCIPAL DE LA APP ---

export default function App() {
    const [user, setUser] = React.useState(null);
    const [userData, setUserData] = React.useState(null);
    const [isAuthLoading, setIsAuthLoading] = React.useState(true);
    const [page, setPage] = React.useState('home');
    const [raffles, setRaffles] = React.useState([]);
    const [rafflesError, setRafflesError] = React.useState('');
    const [selectedRaffleId, setSelectedRaffleId] = React.useState(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const userDocRef = doc(db, "users", currentUser.uid);
                onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserData(docSnap.data());
                    } else {
                        setDoc(userDocRef, {
                            name: currentUser.displayName,
                            email: currentUser.email,
                            photoURL: currentUser.photoURL,
                            mp_connected: false,
                        });
                    }
                });
            } else {
                setUserData(null);
            }
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code && state && user && state === user.uid) {
            alert("Simulando conexión con Mercado Pago. En un entorno real, esto sería procesado por el backend.");
            const userDocRef = doc(db, "users", user.uid);
            setDoc(userDocRef, {
                mp_connected: true,
                mp_access_token: 'dummy_encrypted_token_from_backend',
            }, { merge: true });
            window.history.replaceState({}, document.title, window.location.pathname);
            setPage('profile');
        }
    }, [user]);

    React.useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get('status');
      const externalReference = urlParams.get('external_reference');

      if (paymentStatus === 'approved' && externalReference) {
        const updateTicketsStatus = async () => {
          const orderRef = doc(db, 'orders', externalReference);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists() && orderSnap.data().status !== 'completed') {
            const orderData = orderSnap.data();
            const batch = writeBatch(db);
            orderData.tickets.forEach(ticketNumber => {
              const ticketRef = doc(db, `raffles/${orderData.raffleId}/tickets`, ticketNumber);
              batch.update(ticketRef, { status: 'sold', buyerId: orderData.buyerId });
            });
            batch.update(orderRef, { status: 'completed' });
            await batch.commit();
            alert(`¡Gracias por tu compra! Tus números han sido registrados.`);
          }
        };
        updateTicketsStatus();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }, []);

    React.useEffect(() => {
        if (isAuthLoading) return;
        const q = query(collection(db, "raffles"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const rafflesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRaffles(rafflesData);
            setRafflesError('');
        }, (error) => {
            setRafflesError("No se pudieron cargar las rifas. Esto puede deberse a un problema de permisos en la base de datos. Revisa las instrucciones en el código.");
        });
        return () => unsubscribe();
    }, [isAuthLoading]);

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.log(error);
        }
    };

    const handleLogout = () => {
        auth.signOut();
        setPage('home');
    };

    const renderPage = () => {
        if (isAuthLoading) {
            return <div className="h-screen flex items-center justify-center"><Spinner /></div>;
        }
        if (selectedRaffleId) {
            return <RaffleDetailPage raffleId={selectedRaffleId} user={user} />;
        }
        switch (page) {
            case 'home':
                return <HomePage raffles={raffles} onSelectRaffle={setSelectedRaffleId} error={rafflesError} />;
            case 'createRaffle':
                return user ? <CreateRafflePage user={user} setPage={setPage} /> : <p className="p-8 text-center">Debes iniciar sesión para crear una rifa.</p>;
            case 'profile':
                return user ? <ProfilePage user={user} userData={userData} /> : <p className="p-8 text-center">Debes iniciar sesión para ver tu perfil.</p>;
            default:
                return <HomePage raffles={raffles} onSelectRaffle={setSelectedRaffleId} error={rafflesError} />;
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <Header user={user} onLogin={handleLogin} onLogout={handleLogout} setPage={(p) => { setSelectedRaffleId(null); setPage(p); }} />
            <main>
                {renderPage()}
            </main>
        </div>
    );
}
