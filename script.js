// script.js - Frontend JavaScript for login and dashboard - Enhanced

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const ordersTableBody = document.getElementById('ordersTableBody');
    const logoutButton = document.getElementById('logoutButton');
    const messageArea = document.getElementById('messageArea');
    
    // New elements for enhanced features
    const testConnectionsButton = document.getElementById('testConnectionsButton');
    const apiTestResultsDiv = document.getElementById('apiTestResults');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const filterButton = document.getElementById('filterButton');
    const clearFilterButton = document.getElementById('clearFilterButton');

    const APP_USER = "gm";
    const APP_PASSWORD = "983f9e455f9c";

    // --- Page specific logic ---
    if (loginForm) {
        // --- LOGIN PAGE ---
        if (localStorage.getItem('isLoggedInBeastTracker') === 'true') {
            window.location.href = 'index.html';
            return;
        }
        loginForm.addEventListener('submit', handleLogin);
    } else if (ordersTableBody) {
        // --- DASHBOARD PAGE (index.html) ---
        if (localStorage.getItem('isLoggedInBeastTracker') !== 'true') {
            window.location.href = 'login.html';
            return;
        }
        
        document.getElementById('currentYear').textContent = new Date().getFullYear();

        if (logoutButton) logoutButton.addEventListener('click', handleLogout);
        if (testConnectionsButton) testConnectionsButton.addEventListener('click', handleTestConnections);
        if (filterButton) filterButton.addEventListener('click', () => fetchAndDisplayOrders(true)); // Pass true to indicate filter is applied
        if (clearFilterButton) clearFilterButton.addEventListener('click', handleClearFilters);


        fetchAndDisplayOrders(false); // Initial fetch without explicit filter
    }

    // --- Event Handlers ---
    async function handleLogin(e) {
        e.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;
        const loginMessage = document.getElementById('loginMessage');

        if (username === APP_USER && password === APP_PASSWORD) {
            loginMessage.textContent = 'Login successful! Redirecting...';
            loginMessage.className = 'mt-6 text-center text-sm text-green-400';
            localStorage.setItem('isLoggedInBeastTracker', 'true');
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        } else {
            loginMessage.textContent = 'Invalid username or password.';
            loginMessage.className = 'mt-6 text-center text-sm text-red-400';
            localStorage.removeItem('isLoggedInBeastTracker');
        }
    }

    function handleLogout() {
        localStorage.removeItem('isLoggedInBeastTracker');
        window.location.href = 'login.html';
    }
    
    function handleClearFilters() {
        if(startDateInput) startDateInput.value = '';
        if(endDateInput) endDateInput.value = '';
        fetchAndDisplayOrders(false); // Fetch all data
    }

    async function handleTestConnections() {
        if (!apiTestResultsDiv || !testConnectionsButton) return;
        
        apiTestResultsDiv.innerHTML = '<p class="text-slate-400">Testing API connections... <span class="loader-inline"></span></p>';
        testConnectionsButton.disabled = true;
        testConnectionsButton.classList.add('opacity-50');

        try {
            // IMPORTANT: Replace '/api/test-connections' with your actual deployed backend URL if different
            // const backendBaseUrl = 'https://your-render-backend-app.onrender.com'; // Example
            // const testApiUrl = `${backendBaseUrl}/api/test-connections`;
            const testApiUrl = '/api/test-connections'; // Works if proxied or on same domain

            const response = await fetch(testApiUrl);
            const results = await response.json();

            if (!response.ok) {
                 throw new Error(results.details || `HTTP error ${response.status}`);
            }

            let resultsHtml = '';
            resultsHtml += `<p class="${results.shopify.success ? 'text-green-400' : 'text-red-400'}"><strong>Shopify:</strong> ${results.shopify.message}</p>`;
            resultsHtml += `<p class="${results.correos.success ? 'text-green-400' : 'text-red-400'}"><strong>Correos:</strong> ${results.correos.message}</p>`;
            apiTestResultsDiv.innerHTML = resultsHtml;

        } catch (error) {
            console.error('Error testing connections:', error);
            apiTestResultsDiv.innerHTML = `<p class="text-red-400"><strong>Error:</strong> Failed to run tests. ${error.message}</p>`;
        } finally {
            testConnectionsButton.disabled = false;
            testConnectionsButton.classList.remove('opacity-50');
        }
    }

    // --- Core Data Fetching and Display Logic ---
    function showMessage(text, type = 'loading') {
        if (!messageArea) return;
        messageArea.textContent = text;
        messageArea.className = `mb-6 p-4 text-center rounded-lg ${type}`;
        messageArea.classList.remove('hidden');
        if (type === 'loading') {
            messageArea.innerHTML = `${text} <span class="loader-inline"></span>`;
        }
    }

    function hideMessage() {
        if (!messageArea) return;
        messageArea.classList.add('hidden');
        messageArea.textContent = '';
        messageArea.className = 'mb-6 p-4 text-center rounded-lg hidden';
    }
    
    async function fetchAndDisplayOrders(isFiltered = false) {
        if (!ordersTableBody) return;

        let loadingMessageText = isFiltered ? 'Applying filter and fetching orders...' : 'Fetching all COD orders...';
        showMessage(loadingMessageText, 'loading');
        ordersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8"><div class="loader"></div><p>Loading data...</p></td></tr>`;
        updateSummaryCounts({ delivered: 0, inTransit: 0, returned: 0 });

        // IMPORTANT: Replace '/api/orders' with your actual deployed backend URL if different
        // const backendBaseUrl = 'https://your-render-backend-app.onrender.com'; // Example
        // let apiUrl = `${backendBaseUrl}/api/orders`;
        let apiUrl = '/api/orders'; // Works if proxied or on same domain

        const params = new URLSearchParams();
        if (startDateInput && startDateInput.value) {
            params.append('startDate', startDateInput.value);
        }
        if (endDateInput && endDateInput.value) {
            params.append('endDate', endDateInput.value);
        }
        
        if (params.toString()) {
            apiUrl += `?${params.toString()}`;
        }

        try {
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ details: `HTTP error! Status: ${response.status}` }));
                throw new Error(errorData.details || `Server responded with status: ${response.status}`);
            }

            const orders = await response.json();
            hideMessage();

            if (!Array.isArray(orders)) {
                 throw new Error("Received invalid data format from server.");
            }

            if (orders.length === 0) {
                const noOrdersMsg = isFiltered ? 'No orders found for the selected date range.' : 'No Cash on Delivery orders found matching the criteria.';
                showMessage(noOrdersMsg, 'success');
                ordersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-slate-400">${noOrdersMsg}</td></tr>`;
                return;
            }

            populateTable(orders);
            calculateAndDisplaySummary(orders);

        } catch (error) {
            console.error('Error fetching orders:', error);
            showMessage(`Error fetching orders: ${error.message}. Please try again or test API connections.`, 'error');
            ordersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-400">Failed to load orders. ${error.message}</td></tr>`;
        }
    }

    function populateTable(orders) {
        if (!ordersTableBody) return;
        ordersTableBody.innerHTML = ''; 

        orders.forEach(order => {
            const row = ordersTableBody.insertRow();
            row.className = "hover:bg-slate-700/50 transition-colors duration-150";

            row.insertCell().textContent = order.order_number || 'N/A';
            row.insertCell().textContent = order.order_date || 'N/A'; // Display order date
            row.insertCell().textContent = order.customer || 'N/A';
            
            const trackingCell = row.insertCell();
            if (order.tracking) {
                const trackingLink = document.createElement('a');
                trackingLink.href = `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${order.tracking}`;
                trackingLink.textContent = order.tracking;
                trackingLink.target = "_blank";
                trackingLink.rel = "noopener noreferrer";
                trackingLink.className = "text-sky-400 hover:text-sky-300 hover:underline";
                trackingCell.appendChild(trackingLink);
            } else {
                trackingCell.textContent = 'N/A';
            }

            const statusCell = row.insertCell();
            const statusBadge = document.createElement('span');
            statusBadge.classList.add('status-badge');
            statusBadge.textContent = order.status || 'Unknown';
            statusBadge.title = order.raw_status || order.status;


            switch (order.status ? order.status.toLowerCase() : '') {
                case 'delivered': statusBadge.classList.add('status-delivered'); break;
                case 'in transit': statusBadge.classList.add('status-in-transit'); break;
                case 'returned': statusBadge.classList.add('status-returned'); break;
                case 'tracking error': statusBadge.classList.add('status-error'); break;
                default: statusBadge.classList.add('status-unknown'); break;
            }
            statusCell.appendChild(statusBadge);
        });
    }

    function calculateAndDisplaySummary(orders) {
        let delivered = 0;
        let inTransit = 0;
        let returnedOrError = 0; // Combined for simplicity in summary

        orders.forEach(order => {
            switch (order.status ? order.status.toLowerCase() : '') {
                case 'delivered': delivered++; break;
                case 'in transit': inTransit++; break;
                case 'returned':
                case 'tracking error': // Count tracking errors also in this bucket for summary
                default: returnedOrError++; break; 
            }
        });
        updateSummaryCounts({ delivered, inTransit, returned: returnedOrError });
    }

    function updateSummaryCounts({ delivered, inTransit, returned }) {
        const deliveredCountEl = document.getElementById('deliveredCount');
        const inTransitCountEl = document.getElementById('inTransitCount');
        const returnedCountEl = document.getElementById('returnedCount');

        if (deliveredCountEl) deliveredCountEl.textContent = delivered;
        if (inTransitCountEl) inTransitCountEl.textContent = inTransit;
        if (returnedCountEl) returnedCountEl.textContent = returned;
    }
});
