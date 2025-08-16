import React from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    addDoc,
    collection,
    onSnapshot,
    query,
    where,
    writeBatch,
    Timestamp,
    getDocs,
} from 'firebase/firestore';

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
//
// 4. VARIABLES DE ENTORNO (NO LAS PONGAS AQUÍ DIRECTAMENTE):
//    - En un proyecto real, estas variables irían en un archivo .env y nunca se expondrían en el frontend.
//    - Para esta demostración, las usaremos aquí, pero recuerda que es solo para fines ilustrativos.

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
// REEMPLAZA ESTOS VALORES CON LOS TUYOS
const MOCK_ENV = {
    // Objeto de configuración de Firebase
    FIREBASE_CONFIG: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    },
    // ID de tu aplicación de Mercado Pago
    MERCADOPAGO_APP_ID: import.meta.env.VITE_MERCADOPAGO_APP_ID,
    // Access Token de TU PROPIA cuenta de desarrollador para simular el backend
    // En producción, el backend usaría el token del *organizador* de la rifa
    MERCADOPAGO_ACCESS_TOKEN: import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN,
    // URL de tu app donde Mercado Pago redirigirá al usuario
    MERCADOPAGO_REDIRECT_URI: import.meta.env.VITE_MERCADOPAGO_REDIRECT_URI
};

// --- INICIALIZACIÓN DE FIREBASE ---
// Usamos las variables globales si están disponibles (entorno de Canvas), si no, usamos las de MOCK_ENV
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : MOCK_ENV.FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-raffle-app';

// --- COMPONENTES DE LA UI ---

const Spinner = () => (
    <div className="flex justify-center items-center p-8">
        <svg className="animate-spin h-16 w-16 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const Header = ({ user, onLogin, onLogout, setPage }) => (
    <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-indigo-600 cursor-pointer" onClick={() => setPage('home')}>Rifas Solidarias</h1>
        <nav>
            <button onClick={() => setPage('home')} className="text-gray-600 hover:text-indigo-600 mr-4">Ver Rifas</button>
            {user && <button onClick={() => setPage('createRaffle')} className="text-gray-600 hover:text-indigo-600 mr-4">Crear Rifa</button>}
            {user ? (
                <div className="flex items-center">
                    <button onClick={() => setPage('profile')} className="text-gray-600 hover:text-indigo-600 mr-4">Mi Perfil</button>
                    <button onClick={onLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">Salir</button>
                </div>
            ) : (
                <button onClick={onLogin} className="bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-600">Ingresar con Google</button>
            )}
        </nav>
    </header>
);

const RaffleCard = ({ raffle, onSelect }) => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300">
        <div className="p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">{raffle.title}</h3>
            <p className="text-gray-600 mb-4">{raffle.description}</p>
            <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-indigo-600">${raffle.ticketPrice}</span>
                <button onClick={() => onSelect(raffle.id)} className="bg-indigo-500 text-white px-6 py-2 rounded-full font-semibold hover:bg-indigo-600 transition-colors">
                    Ver Rifa
                </button>
            </div>
        </div>
    </div>
);

const HomePage = ({ raffles, onSelectRaffle, error }) => (
    <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-center">Rifas Activas</h2>
        {error && <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>}
        {raffles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-6">
                {raffles.map(raffle => <RaffleCard key={raffle.id} raffle={raffle} onSelect={onSelectRaffle} />)}
            </div>
        ) : (
            !error && <p className="text-center text-gray-500 mt-10">No hay rifas activas en este momento. ¡Anímate a crear la primera!</p>
        )}
    </div>
);

const CreateRafflePage = ({ user, setPage }) => {
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [ticketPrice, setTicketPrice] = React.useState(100);
    const [ticketCount, setTicketCount] = React.useState(100);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleCreateRaffle = async (e) => {
        e.preventDefault();
        if (!title || !description || ticketPrice <= 0 || ticketCount <= 0) {
            setError('Por favor, completa todos los campos correctamente.');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const organizerRef = doc(db, `users/${user.uid}`);
            const organizerSnap = await getDoc(organizerRef);
            if (!organizerSnap.exists() || !organizerSnap.data().mp_connected) {
                throw new Error("Debes conectar tu cuenta de Mercado Pago en tu perfil antes de crear una rifa.");
            }

            const raffleData = {
                title,
                description,
                ticketPrice: Number(ticketPrice),
                ticketCount: Number(ticketCount),
                organizerId: user.uid,
                organizerName: user.displayName,
                createdAt: Timestamp.now(),
            };

            const raffleRef = await addDoc(collection(db, 'raffles'), raffleData);

            const batch = writeBatch(db);
            for (let i = 1; i <= ticketCount; i++) {
                const ticketNumber = String(i).padStart(String(ticketCount).length, '0');
                const ticketRef = doc(db, `raffles/${raffleRef.id}/tickets`, ticketNumber);
                batch.set(ticketRef, { number: ticketNumber, status: 'available' });
            }
            await batch.commit();

            alert('¡Rifa creada con éxito!');
            setPage('home');

        } catch (err) {
            setError(err.message);
            console.error("Error creating raffle:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-xl mt-10">
            <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Crear Nueva Rifa Solidaria</h2>
            <form onSubmit={handleCreateRaffle}>
                <div className="mb-4">
                    <label className="block text-gray-700 font-bold mb-2" htmlFor="title">Título del Premio</label>
                    <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 font-bold mb-2" htmlFor="description">Descripción de la Causa</label>
                    <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 font-bold mb-2" htmlFor="ticketPrice">Precio por Número ($)</label>
                    <input type="number" id="ticketPrice" value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="mb-6">
                    <label className="block text-gray-700 font-bold mb-2" htmlFor="ticketCount">Cantidad de Números</label>
                    <input type="number" id="ticketCount" value={ticketCount} onChange={e => setTicketCount(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors">
                    {isLoading ? 'Creando...' : 'Crear Rifa'}
                </button>
            </form>
        </div>
    );
};

const ProfilePage = ({ user, userData }) => {
    const handleConnectMP = () => {
        const authUrl = `https://auth.mercadopago.com/authorization?client_id=${MOCK_ENV.MERCADOPAGO_APP_ID}&response_type=code&platform_id=mp&state=${user.uid}&redirect_uri=${MOCK_ENV.MERCADOPAGO_REDIRECT_URI}`;
        window.location.href = authUrl;
    };

    return (
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-xl mt-10">
            <h2 className="text-3xl font-bold mb-6 text-center">Mi Perfil</h2>
            <div className="text-center">
                <img src={user.photoURL} alt={user.displayName} className="w-24 h-24 rounded-full mx-auto mb-4" />
                <h3 className="text-xl font-semibold">{user.displayName}</h3>
                <p className="text-gray-500">{user.email}</p>
                <div className="mt-8">
                    <h4 className="text-lg font-bold mb-2">Conexión con Mercado Pago</h4>
                    {userData?.mp_connected ? (
                        <div className="bg-green-100 text-green-800 p-4 rounded-lg">
                            <p className="font-semibold">¡Tu cuenta de Mercado Pago está conectada!</p>
                            <p className="text-sm">Ya puedes crear rifas y recibir los pagos directamente en tu cuenta.</p>
                        </div>
                    ) : (
                        <div>
                            <p className="mb-4">Para poder crear rifas, necesitas conectar tu cuenta de Mercado Pago. El dinero de las ventas irá directamente a tu cuenta.</p>
                            <button onClick={handleConnectMP} className="bg-blue-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-600 transition-colors">
                                Conectar con Mercado Pago
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const RaffleDetailPage = ({ raffleId, user }) => {
    const [raffle, setRaffle] = React.useState(null);
    const [tickets, setTickets] = React.useState([]);
    const [selectedTickets, setSelectedTickets] = React.useState(new Set());
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);

    React.useEffect(() => {
        const unsubRaffle = onSnapshot(doc(db, 'raffles', raffleId), (doc) => {
            if (doc.exists()) {
                setRaffle({ id: doc.id, ...doc.data() });
            } else {
                setError("La rifa no existe.");
            }
        }, (err) => {
            console.error("Error fetching raffle details:", err);
            setError("No se pudo cargar la rifa. Verifica tus permisos.");
        });

        const ticketsQuery = query(collection(db, `raffles/${raffleId}/tickets`));
        const unsubTickets = onSnapshot(ticketsQuery, (querySnapshot) => {
            const ticketsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            ticketsData.sort((a, b) => a.number.localeCompare(b.number));
            setTickets(ticketsData);
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching tickets:", err);
            setError("No se pudieron cargar los números. Verifica tus permisos.");
            setIsLoading(false);
        });

        return () => {
            unsubRaffle();
            unsubTickets();
        };
    }, [raffleId]);

    const handleTicketClick = (ticket) => {
        if (ticket.status !== 'available') return;

        const newSelection = new Set(selectedTickets);
        if (newSelection.has(ticket.number)) {
            newSelection.delete(ticket.number);
        } else {
            newSelection.add(ticket.number);
        }
        setSelectedTickets(newSelection);
    };

    const handleCheckout = async () => {
        if (selectedTickets.size === 0) {
            alert("Por favor, selecciona al menos un número.");
            return;
        }
        if (!user) {
            alert("Debes iniciar sesión para comprar.");
            return;
        }

        setIsProcessingPayment(true);
        setError('');

        try {
            const orderData = {
                raffleId,
                buyerId: user.uid,
                tickets: Array.from(selectedTickets),
                total: selectedTickets.size * raffle.ticketPrice,
                status: 'pending',
                createdAt: Timestamp.now(),
            };
            const orderRef = await addDoc(collection(db, 'orders'), orderData);

            const organizerRef = doc(db, `users/${raffle.organizerId}`);
            const organizerSnap = await getDoc(organizerRef);
            if (!organizerSnap.exists() || !organizerSnap.data().mp_access_token) {
                throw new Error("El organizador no tiene una cuenta de Mercado Pago conectada.");
            }
            const organizerAccessToken = organizerSnap.data().mp_access_token;

            const items = Array.from(selectedTickets).map(number => ({
                title: `${raffle.title} - Número ${number}`,
                quantity: 1,
                unit_price: raffle.ticketPrice,
                currency_id: 'ARS'
            }));

            const preference = {
                items,
                external_reference: orderRef.id,
                back_urls: {
                    success: window.location.href,
                    failure: window.location.href,
                    pending: window.location.href,
                },
                auto_return: 'approved',
            };

            const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MOCK_ENV.MERCADOPAGO_ACCESS_TOKEN}`
                },
                body: JSON.stringify(preference)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error de Mercado Pago:", errorData);
                throw new Error("Error al crear la preferencia de pago.");
            }

            const data = await response.json();
            window.location.href = data.init_point;

        } catch (err) {
            setError(err.message);
            console.error("Checkout error:", err);
        } finally {
            setIsProcessingPayment(false);
        }
    };

    if (isLoading) return <Spinner />;
    if (error) return <p className="text-center text-red-500 p-8">{error}</p>;

    const soldCount = tickets.filter(t => t.status === 'sold').length;
    const progress = (soldCount / (raffle?.ticketCount || tickets.length)) * 100;

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-bold mb-2 text-center">{raffle.title}</h2>
            <p className="text-gray-600 mb-4 text-center">{raffle.description}</p>
            <p className="text-center text-sm text-gray-500 mb-6">Organizado por: {raffle.organizerName}</p>

            <div className="mb-6">
                <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-indigo-700">Progreso</span>
                    <span className="text-sm font-medium text-indigo-700">{soldCount} de {raffle.ticketCount} vendidos</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                    <div className="bg-indigo-600 h-4 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 lg:grid-cols-15 xl:grid-cols-20 gap-2">
                {tickets.map(ticket => {
                    const isSelected = selectedTickets.has(ticket.number);
                    let bgColor = 'bg-white';
                    let textColor = 'text-gray-800';
                    let hoverClass = 'hover:bg-indigo-100';

                    if (ticket.status === 'sold') {
                        bgColor = 'bg-gray-400';
                        textColor = 'text-white';
                        hoverClass = '';
                    } else if (isSelected) {
                        bgColor = 'bg-indigo-500';
                        textColor = 'text-white';
                    }

                    return (
                        <button
                            key={ticket.id}
                            onClick={() => handleTicketClick(ticket)}
                            disabled={ticket.status === 'sold'}
                            className={`p-2 rounded-md text-center font-bold border-2 border-gray-200 transition-colors duration-200 ${bgColor} ${textColor} ${hoverClass} disabled:cursor-not-allowed`}
                        >
                            {ticket.number}
                        </button>
                    );
                })}
            </div>

            <div className="mt-8 sticky bottom-0 bg-white p-4 shadow-lg rounded-t-lg border-t-2">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center">
                    <div>
                        <h4 className="font-bold text-lg">Números seleccionados: {selectedTickets.size}</h4>
                        <p className="text-gray-600">Total a pagar: <span className="font-bold text-xl">${selectedTickets.size * raffle.ticketPrice}</span></p>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={isProcessingPayment || selectedTickets.size === 0}
                        className="w-full md:w-auto mt-4 md:mt-0 bg-green-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors"
                    >
                        {isProcessingPayment ? 'Procesando...' : 'Pagar con Mercado Pago'}
                    </button>
                </div>
                {error && <p className="text-red-500 text-center mt-2">{error}</p>}
            </div>
        </div>
    );
};


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
                const unsubUser = onSnapshot(userDocRef, (docSnap) => {
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
                // No necesitamos desuscribirnos aquí ya que el componente vive siempre
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
            console.log("Mercado Pago code received:", code);
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
        console.log(`Pago aprobado para la orden: ${externalReference}`);

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
            console.log("Tickets actualizados a 'sold'");
          }
        };

        updateTicketsStatus();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }, []);

    React.useEffect(() => {
        if (isAuthLoading) return; // No hacer nada hasta que la autenticación esté lista

        const q = query(collection(db, "raffles"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const rafflesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRaffles(rafflesData);
            setRafflesError(''); // Limpiar error si la carga es exitosa
        }, (error) => {
            console.error("Error fetching raffles:", error);
            setRafflesError("No se pudieron cargar las rifas. Esto puede deberse a un problema de permisos en la base de datos. Revisa las instrucciones en el código.");
        });
        return () => unsubscribe();
    }, [isAuthLoading]);

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error during sign-in:", error);
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
