// correos.js
// Logic to fetch tracking status from Correos Spain API - Enhanced

const axios = require('axios');

const CORREOS_CLIENT_ID = process.env.CORREOS_CLIENT_ID;
const CORREOS_SECRET = process.env.CORREOS_SECRET;

async function getCorreosTrackingStatus(trackingNumber) {
    if (!CORREOS_CLIENT_ID || !CORREOS_SECRET) {
        console.error('Correos API credentials are not set in environment variables.');
        throw new Error('Correos API credentials are not set.');
    }
    if (!trackingNumber) {
        throw new Error('Tracking number is required.');
    }
    
    const encodedTrackingNumber = encodeURIComponent(String(trackingNumber).trim());
    const correosApiUrl = `https://localizador.correos.es/canonico/eventos_envio_servicio_auth/${encodedTrackingNumber}?codIdioma=ES&indUltEvento=S`;
    const authHeader = `Basic ${Buffer.from(`${CORREOS_CLIENT_ID}:${CORREOS_SECRET}`).toString('base64')}`;

    try {
        const response = await axios.get(correosApiUrl, {
            headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            timeout: 7000 // 7 second timeout
        });

        let latestEventDescription = "Status Not Found";
        if (response.data) {
            if (Array.isArray(response.data.eventos) && response.data.eventos.length > 0) {
                latestEventDescription = response.data.eventos[0].descEvento || response.data.eventos[0].desEvento || "No description";
            } else if (response.data.descEvento || response.data.desEvento) {
                latestEventDescription = response.data.descEvento || response.data.desEvento;
            } else if (response.data.evento && (response.data.evento.descEvento || response.data.evento.desEvento)) {
                latestEventDescription = response.data.evento.descEvento || response.data.evento.desEvento;
            } else if (response.data.datosEnvios && Array.isArray(response.data.datosEnvios) && response.data.datosEnvios.length > 0) {
                const envio = response.data.datosEnvios[0];
                if (envio.eventos && Array.isArray(envio.eventos) && envio.eventos.length > 0) {
                    latestEventDescription = envio.eventos[0].descEvento || envio.eventos[0].desEvento || "No description";
                } else if (envio.desEstado) {
                     latestEventDescription = envio.desEstado;
                }
            } else if (response.data.error && response.data.error.descripcion) { // Handle API error structure
                latestEventDescription = `Error: ${response.data.error.descripcion}`;
            } else {
                console.warn(`Correos API response for ${trackingNumber} has unexpected structure:`, response.data);
                latestEventDescription = typeof response.data === 'string' ? response.data : "Unknown structure";
            }
        }
        return latestEventDescription;

    } catch (error) {
        console.error(`Error fetching Correos tracking for ${trackingNumber}:`);
        if (error.response) {
            const errorDesc = error.response.data?.error?.descripcion || error.response.data?.message || JSON.stringify(error.response.data);
            if (error.response.status === 401 || error.response.status === 403) {
                 throw new Error(`Correos API Authentication Failed: ${error.response.status}. Check Client ID and Secret.`);
            }
            if (error.response.status === 404) {
                return "Tracking Not Found in Correos"; // Specific message for 404
            }
            throw new Error(`Correos API request failed: ${error.response.status} - ${errorDesc}`);
        } else if (error.request) {
             if (error.code === 'ECONNABORTED') {
                throw new Error('Correos API connection timed out.');
            }
            throw new Error('Correos API request made but no response received.');
        } else {
            throw new Error(`Error in Correos request setup: ${error.message}`);
        }
    }
}

// Function to test Correos API connection
async function testCorreosConnection() {
    if (!CORREOS_CLIENT_ID || !CORREOS_SECRET) {
        return { success: false, message: 'Correos API credentials (Client ID or Secret) are not set in environment variables.' };
    }
    // Attempt to authenticate. Correos doesn't have a simple "ping" endpoint without a tracking number.
    // We can try a request with a dummy tracking number; a 404 or specific error can still indicate auth success if not 401/403.
    // Or, if they have a token endpoint (not specified in prompt), that would be better.
    // For now, we'll infer based on the error for a dummy tracking number.
    const dummyTrackingNumber = "TEST000000000ES"; // A non-existent tracking number
    const correosTestApiUrl = `https://localizador.correos.es/canonico/eventos_envio_servicio_auth/${dummyTrackingNumber}?codIdioma=ES&indUltEvento=S`;
    const authHeader = `Basic ${Buffer.from(`${CORREOS_CLIENT_ID}:${CORREOS_SECRET}`).toString('base64')}`;

    try {
        await axios.get(correosTestApiUrl, {
            headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            timeout: 7000 // 7 second timeout
        });
        // If it doesn't throw an error, or returns data for a test number (unlikely), it's a success.
        // More likely, it will throw a 404 for the dummy number, which is fine for an auth check.
        return { success: true, message: 'Successfully authenticated with Correos API (dummy tracking number used for test).' };
    } catch (error) {
        if (error.response) {
            if (error.response.status === 404 || error.response.status === 400) { // 404 for not found, 400 for invalid format
                // This means authentication itself likely worked, but the tracking number was invalid/not found.
                return { success: true, message: `Authenticated with Correos API. Test tracking number ${dummyTrackingNumber} was not found (expected).` };
            } else if (error.response.status === 401 || error.response.status === 403) {
                return { success: false, message: `Correos API Authentication Failed: ${error.response.status}. Check Client ID and Secret.` };
            }
            return { success: false, message: `Correos API request failed during test: ${error.response.status} - ${error.response.data?.error?.descripcion || JSON.stringify(error.response.data)}` };
        } else if (error.code === 'ECONNABORTED') {
            return { success: false, message: 'Correos API connection timed out.' };
        }
        return { success: false, message: `Correos connection test failed: ${error.message}` };
    }
}

module.exports = { getCorreosTrackingStatus, testCorreosConnection };
