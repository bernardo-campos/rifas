import React from 'react';
import { MOCK_ENV } from '../firebase';

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

export default ProfilePage;
