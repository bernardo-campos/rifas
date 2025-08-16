/* eslint-disable no-undef */
// Webhook para Mercado Pago usando el SDK oficial
import express from 'express';
import { MercadoPagoConfig } from 'mercadopago';
import crypto from 'crypto';

const app = express();
const PORT = process.env.VITE_MERCADOPAGO_WEBHOOK_PORT || 5001;

// Configurar MercadoPago con tu Access Token
const client = new MercadoPagoConfig({
    accessToken: process.env.VITE_MERCADOPAGO_ACCESS_TOKEN,
    options: {
        timeout: 5000,
    }
});

// Lee la clave secreta del webhook desde variable de entorno
const MP_WEBHOOK_SECRET = process.env.VITE_MERCADOPAGO_WEBHOOK_SECRET;

// Middleware para capturar el body raw (necesario para validación de firma)
app.use('/webhooks/mercadopago', express.raw({ type: 'application/json' }));
app.use(express.json());

// Función para validar webhook usando el formato oficial de MercadoPago
function validateMercadoPagoWebhook(signature, secret, dataId, requestId, timestamp) {
    if (!signature || !secret) {
        return false;
    }

    try {
        // Parse de la signature: ts=timestamp,v1=hash
        const elements = signature.split(',');
        let receivedHash;
        
        elements.forEach(element => {
            const [key, value] = element.split('=');
            if (key === 'v1') receivedHash = value;
        });

        if (!receivedHash) {
            return false;
        }

        // Formato oficial de MercadoPago: "id:$dataID;request-id:$requestId;ts:$timestamp;"
        const manifest = `id:${dataId || ''};request-id:${requestId || ''};ts:${timestamp};`;
        
        // Generar HMAC SHA256
        const expectedHash = crypto
            .createHmac('sha256', secret)
            .update(manifest, 'utf8')
            .digest('hex');

        return expectedHash === receivedHash;
        
    } catch (error) {
        console.error('Error validando webhook:', error);
        return false;
    }
}

// Endpoint para recibir notificaciones de Mercado Pago
app.post('/webhooks/mercadopago', async (req, res) => {
    console.log('📥 Webhook recibido de MercadoPago');
    
    const signature = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];
    const body = req.body.toString();
    
    try {
        const webhookData = JSON.parse(body);
        console.log('Datos del webhook:', webhookData);
        
        // Extraer información necesaria para validación
        const dataId = req.query['data.id'] || req.query.id || webhookData.data?.id;
        const timestamp = signature.split(',').find(part => part.startsWith('ts='))?.split('=')[1];
        
        // Si no hay secreto configurado, acepta en modo desarrollo
        if (!MP_WEBHOOK_SECRET || process.env.NODE_ENV === 'development') {
            console.warn('⚠️  MODO DESARROLLO - aceptando webhook sin validación');
        } else {
            // Validar la firma del webhook
            const isValid = validateMercadoPagoWebhook(
                signature,
                MP_WEBHOOK_SECRET,
                dataId,
                requestId,
                timestamp
            );
            
            if (!isValid) {
                console.warn('❌ Firma de webhook inválida');
                return res.status(401).send('Unauthorized');
            }
            
            console.log('✅ Webhook válido');
        }
        
        // Procesar el evento según el tipo
        switch (webhookData.action || webhookData.type) {
            case 'payment.created':
                console.log('💰 Nuevo pago creado:', dataId);
                await handlePaymentCreated(dataId, webhookData);
                break;
                
            case 'payment.updated':
                console.log('🔄 Pago actualizado:', dataId);
                await handlePaymentUpdated(dataId, webhookData);
                break;
                
            case 'test.created':
            case 'test':
                console.log('🧪 Evento de prueba recibido');
                break;
                
            case 'merchant_order':
                console.log('📋 Orden de comercio:', dataId);
                await handleMerchantOrder(dataId, webhookData);
                break;
                
            default:
                console.log('📝 Evento no manejado:', webhookData.action || webhookData.type);
        }
        
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('Error procesando webhook:', error);
        res.status(400).send('Bad Request');
    }
});

// Funciones para manejar diferentes tipos de eventos
async function handlePaymentCreated(paymentId, webhookData) {
    console.log(`Procesando nuevo pago: ${paymentId}`);
    // Aquí puedes:
    // 1. Consultar los detalles del pago usando el SDK
    // 2. Actualizar tu base de datos
    // 3. Enviar notificaciones al usuario
    
    // Ejemplo usando el SDK:
    // const payment = new Payment(client);
    // const paymentDetails = await payment.get({ id: paymentId });
    // console.log('Detalles del pago:', paymentDetails);
}

async function handlePaymentUpdated(paymentId, webhookData) {
    console.log(`Procesando actualización de pago: ${paymentId}`);
    // Lógica para manejar actualizaciones de pago
}

async function handleMerchantOrder(orderId, webhookData) {
    console.log(`Procesando orden de comercio: ${orderId}`);
    // Lógica para manejar órdenes de comercio
}

// Endpoints de utilidad
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        webhook_secret_configured: !!MP_WEBHOOK_SECRET,
        access_token_configured: !!process.env.VITE_MERCADOPAGO_ACCESS_TOKEN,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.send('🚀 Webhook de Mercado Pago activo');
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor webhook escuchando en puerto ${PORT}`);
    console.log(`📡 Endpoint: http://localhost:${PORT}/webhooks/mercadopago`);
    console.log(`🔐 Configuración:`);
    console.log(`   - Webhook secret: ${MP_WEBHOOK_SECRET ? '✅ Configurado' : '❌ Faltante'}`);
    console.log(`   - Access token: ${process.env.VITE_MERCADOPAGO_ACCESS_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
    console.log(`   - Modo: ${process.env.NODE_ENV || 'production'}`);
});