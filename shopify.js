// shopify.js
// Logic to fetch and process Shopify orders - Enhanced

const axios = require('axios');
const { getCorreosTrackingStatus } = require('./correos');

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const API_VERSION = '2024-04'; // Use a recent stable API version

// Helper function to map Correos status
function mapCorreosStatus(correosStatusText) {
    if (!correosStatusText) return "Unknown";
    const status = correosStatusText.toUpperCase();
    if (status.includes("ENTREGADO")) return "Delivered";
    if (status.includes("EN REPARTO") || status.includes("EN PROCESO DE ENTREGA") || status.includes("ADMITIDO") || status.includes("EN OFICINA DE CAMBIO") || status.includes("LLEGADA A LA OFICINA DE ENTREGA") || status.includes("SALIDA DE OFICINA DE CAMBIO")) return "In Transit";
    if (status.includes("DEVUELTO") || status.includes("NO ENTREGADO") || status.includes("RETORNADO") || status.includes("ENTREGA FALLIDA")) return "Returned";
    if (status.includes("EN TRÁNSITO") || status.includes("EN CAMINO") || status.includes("EN DISTRIBUCIÓN")) return "In Transit";
    console.warn(`Unmapped Correos status: ${correosStatusText}`);
    return correosStatusText;
}

// Fetches fulfilled COD orders from Shopify with optional date filtering
async function getShopifyOrdersAndTracking(startDate, endDate) {
    if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_DOMAIN) {
        console.error('Shopify API credentials are not set in environment variables.');
        throw new Error('Shopify API credentials are not set.');
    }

    const shopifyApiUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/orders.json`;
    const params = {
        status: 'any',
        fulfillment_status: 'shipped',
        fields: 'id,name,order_number,fulfillments,gateway,payment_gateway_names,customer,financial_status,created_at',
        limit: 250, // Increased limit, consider pagination for very large stores
        order: 'created_at DESC' // Get recent orders first
    };

    // Add date filters if provided and valid
    if (startDate) {
        const sDate = new Date(startDate);
        if (!isNaN(sDate)) {
            params.created_at_min = sDate.toISOString();
        } else {
            console.warn(`Invalid startDate format: ${startDate}. Ignoring.`);
        }
    }
    if (endDate) {
        let eDate = new Date(endDate);
        if (!isNaN(eDate)) {
            // Shopify's created_at_max is exclusive, so to include the whole day, set to end of day
            eDate.setHours(23, 59, 59, 999);
            params.created_at_max = eDate.toISOString();
        } else {
            console.warn(`Invalid endDate format: ${endDate}. Ignoring.`);
        }
    }
    
    console.log(`Fetching orders from Shopify with params: ${JSON.stringify(params)}`);

    try {
        const response = await axios.get(shopifyApiUrl, {
            headers: {
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                'Content-Type': 'application/json'
            },
            params: params
        });

        const orders = response.data.orders;
        console.log(`Fetched ${orders.length} orders from Shopify. Filtering for COD and tracking...`);
        const codOrdersWithTrackingInfo = [];

        for (const order of orders) {
            const isCOD = (order.gateway && order.gateway.toLowerCase().includes('cash on delivery')) ||
                          (order.payment_gateway_names && order.payment_gateway_names.some(name => name.toLowerCase().includes('cash on delivery'))) ||
                          (order.financial_status === 'pending' && order.gateway && order.gateway.toLowerCase().includes('manual')) ; // Common for COD

            if (!isCOD) continue;

            if (order.fulfillments && order.fulfillments.length > 0) {
                for (const fulfillment of order.fulfillments) {
                    const trackingNumber = fulfillment.tracking_number;
                    const trackingCompany = fulfillment.tracking_company ? fulfillment.tracking_company.toLowerCase() : null;

                    if (trackingNumber && (trackingCompany === 'correos' || trackingCompany === null || trackingCompany === '' || trackingCompany === 'correos express' || trackingCompany.includes('correos'))) {
                        console.log(`Order ${order.name} (${trackingNumber}): Fetching Correos status...`);
                        try {
                            const correosStatusText = await getCorreosTrackingStatus(trackingNumber);
                            const simplifiedStatus = mapCorreosStatus(correosStatusText);
                            
                            codOrdersWithTrackingInfo.push({
                                order_number: order.name,
                                customer: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 'N/A',
                                tracking: trackingNumber,
                                status: simplifiedStatus,
                                raw_status: correosStatusText,
                                order_date: new Date(order.created_at).toLocaleDateString() // Add order date
                            });
                            break; 
                        } catch (trackingError) {
                            console.error(`Failed to get Correos status for ${trackingNumber} (Order ${order.name}):`, trackingError.message);
                            codOrdersWithTrackingInfo.push({
                                order_number: order.name,
                                customer: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 'N/A',
                                tracking: trackingNumber,
                                status: "Tracking Error",
                                raw_status: trackingError.message,
                                order_date: new Date(order.created_at).toLocaleDateString()
                            });
                            break; 
                        }
                    }
                }
            }
        }
        console.log(`Processed orders. Found ${codOrdersWithTrackingInfo.length} relevant COD orders with tracking attempts.`);
        return codOrdersWithTrackingInfo;

    } catch (error) {
        console.error('Error fetching Shopify orders:');
        if (error.response) {
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
            throw new Error(`Shopify API request failed: ${error.response.status} - ${JSON.stringify(error.response.data.errors || error.response.data)}`);
        } else if (error.request) {
            throw new Error('Shopify API request made but no response received.');
        } else {
            throw new Error(`Error in Shopify request setup: ${error.message}`);
        }
    }
}

// Function to test Shopify API connection
async function testShopifyConnection() {
    if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_DOMAIN) {
        return { success: false, message: 'Shopify API credentials (token or domain) are not set in environment variables.' };
    }
    // A simple API call, like fetching shop details
    const shopifyTestUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/shop.json`;
    try {
        await axios.get(shopifyTestUrl, {
            headers: {
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 second timeout
        });
        return { success: true, message: 'Successfully connected to Shopify API.' };
    } catch (error) {
        console.error('Shopify connection test failed:', error.message);
        if (error.response) {
             let shopifyErrorMsg = `Shopify API request failed: ${error.response.status}.`;
             if(error.response.data && error.response.data.errors){
                shopifyErrorMsg += ` Details: ${JSON.stringify(error.response.data.errors)}`;
             } else if (typeof error.response.data === 'string' && error.response.data.includes('Authentication_error')) {
                shopifyErrorMsg += ' Details: Authentication error. Check API token and scopes.';
             } else if (error.response.status === 401) {
                shopifyErrorMsg += ' Details: Unauthorized. Check API token and scopes.';
             } else if (error.response.status === 403) {
                shopifyErrorMsg += ' Details: Forbidden. Check API token permissions/scopes.';
             }
            return { success: false, message: shopifyErrorMsg };
        } else if (error.code === 'ECONNABORTED') {
            return { success: false, message: 'Shopify API connection timed out. Check store domain and network.' };
        }
        return { success: false, message: `Shopify connection test failed: ${error.message}` };
    }
}

module.exports = { getShopifyOrdersAndTracking, testShopifyConnection };
