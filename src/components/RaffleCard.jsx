import React from 'react';

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

export default RaffleCard;
