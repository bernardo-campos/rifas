import React from 'react';

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

export default Header;
