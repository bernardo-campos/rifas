import React from 'react';
import RaffleCard from './RaffleCard';

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

export default HomePage;
