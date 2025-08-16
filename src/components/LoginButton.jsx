import React from 'react';

const LoginButton = ({ onLogin }) => (
    <button onClick={onLogin} className="bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-600">Ingresar con Google</button>
);

export default LoginButton;
