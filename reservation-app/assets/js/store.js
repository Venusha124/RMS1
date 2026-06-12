const API_URL = '/api';

const store = {
    data: {
        customers: [],
        eventRooms: [],
        reservations: [],
        inquiries: [],
        waitlist: [],
        maintenanceTasks: [],
        equipment: [],
        masterBookings: [],
        notifications: [],
        settings: { business_name: 'IMPERIAL', currency_symbol: 'Rs.' },
        currentUser: JSON.parse(localStorage.getItem('reservationUser')) || null
    },

    async fetchAPI(endpoint, options = {}) {
        const url = `${API_URL}${endpoint}`;
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response;
    },

    async init() {
        await this.refreshData();
        this.setupSocket();
        this.fetchNotifications();
    },

    setupSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io('http://localhost:302');
            this.socket.on('data_updated', async () => {
                await this.refreshData();
                showToast('Data synced in real-time', 'info');
                // Re-render current route
                if (typeof navigate === 'function' && typeof currentRoute !== 'undefined') {
                    navigate(currentRoute);
                }
            });
            this.socket.on('new_notification', (data) => {
                if (this.data.currentUser && this.data.currentUser.role === data.role) {
                    showToast(data.message, 'success');
                    this.fetchNotifications();
                }
            });
        }
    },

    async fetchNotifications() {
        if (!this.data.currentUser) return;
        const res = await this.fetchAPI('/notifications?role=' + this.data.currentUser.role);
        const data = await res.json();
        this.data.notifications = data.notifications || [];
        window.dispatchEvent(new CustomEvent('notifications_updated'));
    },

    async login(username, password) {
        try {
            const res = await this.fetchAPI('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            this.data.currentUser = data.user;
            localStorage.setItem('reservationUser', JSON.stringify(data.user));
            window.dispatchEvent(new CustomEvent('auth_changed'));
            return { success: true };
        } catch (err) {
            return { success: false, error: "Invalid credentials or server error" };
        }
    },

    logout() {
        this.data.currentUser = null;
        localStorage.removeItem('reservationUser');
        window.dispatchEvent(new CustomEvent('auth_changed'));
    },

    async refreshData() {
        try {
            const [customers, eventRooms, reservations, inquiries, waitlist, maintenanceTasks, settings, equipment, masterBookings] = await Promise.all([
                this.fetchAPI('/customers').then(r => r.json()),
                this.fetchAPI('/event-rooms').then(r => r.json()),
                this.fetchAPI('/reservations').then(r => r.json()),
                this.fetchAPI('/inquiries').then(r => r.json()),
                this.fetchAPI('/waitlist').then(r => r.json()),
                this.fetchAPI('/maintenance-tasks').then(r => r.json()),
                this.fetchAPI('/settings').then(r => r.json()).catch(() => ({ business_name: 'IMPERIAL', currency_symbol: 'Rs.' })),
                this.fetchAPI('/equipment').then(r => r.json()).catch(() => []),
                this.fetchAPI('/master-bookings').then(r => r.json()).catch(() => [])
            ]);
            this.data.customers        = customers;
            this.data.eventRooms       = eventRooms;
            this.data.reservations     = reservations;
            this.data.inquiries        = inquiries;
            this.data.waitlist         = waitlist;
            this.data.maintenanceTasks = maintenanceTasks;
            this.data.settings         = settings;
            this.data.equipment        = equipment;
            this.data.masterBookings   = masterBookings;
            window.dispatchEvent(new CustomEvent('store_updated'));
        } catch (error) {
            console.error('Store refresh error:', error);
        }
    }
};
