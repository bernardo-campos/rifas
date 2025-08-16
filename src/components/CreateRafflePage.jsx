import React from 'react';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection, writeBatch, Timestamp } from 'firebase/firestore';

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

export default CreateRafflePage;
