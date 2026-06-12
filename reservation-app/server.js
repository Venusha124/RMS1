const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const db = require('../database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 uploads
app.use(express.static(path.join(__dirname, '')));

io.on('connection', (socket) => {
    console.log('Client connected to reservation socket');
});

// --- DATABASE HELPERS ---
const runQuery = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const allQuery = (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const getOne = (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const promoteWaitlistIfAny = async (roomId) => {
    if (!roomId) return null;
    const nextInLine = await getOne("SELECT * FROM waitlist WHERE room_id = ? ORDER BY created_at ASC LIMIT 1", [roomId]);
    if (nextInLine) {
        // Insert new pending reservation
        const result = await runQuery(`
            INSERT INTO reservations (event_name, customer_name, customer_phone, room_id, date_start, date_end, num_guests, status, total_price, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', 0.0, ?, datetime('now'))
        `, [nextInLine.event_name || 'Waitlisted Event', nextInLine.customer_name, nextInLine.customer_phone, roomId, nextInLine.date_start, nextInLine.date_end, nextInLine.num_guests, nextInLine.notes || 'Promoted from Waitlist']);
        
        // Seed default setup/buffer tasks
        await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Pre-event Venue Setup', 'Pending')", [roomId, result.lastID]);
        await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'AV sound and display systems check', 'Pending')", [roomId, result.lastID]);
        await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Post-event cleaning and buffer preparation', 'Pending')", [roomId, result.lastID]);
        
        // Set room status to Maintenance for setup/buffer
        await runQuery("UPDATE event_rooms SET status = 'Maintenance' WHERE id = ?", [roomId]);

        // Delete from waitlist
        await runQuery("DELETE FROM waitlist WHERE id = ?", [nextInLine.id]);
        
        return {
            reservation_id: result.lastID,
            customer_name: nextInLine.customer_name,
            event_name: nextInLine.event_name
        };
    }
    return null;
};

// ─── Ensure tables exist (safe for shared DB) ───────────────────────────────
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS event_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        capacity INTEGER,
        price_per_day REAL,
        type TEXT,
        status TEXT DEFAULT 'Available'
    )`, () => {
        db.run("ALTER TABLE event_rooms ADD COLUMN setup_buffer_hours REAL DEFAULT 0", () => {});
        db.run("ALTER TABLE event_rooms ADD COLUMN cleanup_buffer_hours REAL DEFAULT 0", () => {});
    });

    db.run(`CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        room_id INTEGER,
        date_start TEXT,
        date_end TEXT,
        num_guests INTEGER,
        status TEXT DEFAULT 'Pending',
        total_price REAL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        inquiry_ref_no TEXT,
        booking_no TEXT,
        menu_selections TEXT,
        FOREIGN KEY(room_id) REFERENCES event_rooms(id)
    )`);

    // Add notes & created_at columns if upgrading an older DB
    db.run("ALTER TABLE reservations ADD COLUMN notes TEXT", () => {});
    db.run("ALTER TABLE reservations ADD COLUMN created_at TEXT DEFAULT (datetime('now'))", () => {});
    db.run("ALTER TABLE reservations ADD COLUMN signature_data TEXT", () => {});
    db.run("ALTER TABLE reservations ADD COLUMN inquiry_ref_no TEXT", () => {});
    db.run("ALTER TABLE reservations ADD COLUMN booking_no TEXT", () => {});
    db.run("ALTER TABLE reservations ADD COLUMN menu_selections TEXT", () => {});
    db.run("ALTER TABLE reservations ADD COLUMN master_booking_id INTEGER", () => {});
    db.run("ALTER TABLE reservations ADD COLUMN payment_slip TEXT", () => {});
    db.run("ALTER TABLE inquiries ADD COLUMN menu_selections TEXT", () => {});

    // ── Notifications Table ──────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`);

    // ── Waitlist Table ───────────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER,
        customer_name TEXT,
        customer_phone TEXT,
        date_start TEXT,
        date_end TEXT,
        num_guests INTEGER,
        event_name TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(room_id) REFERENCES event_rooms(id)
    )`);

    // ── Maintenance Tasks Table ──────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER,
        reservation_id INTEGER,
        task_name TEXT,
        status TEXT DEFAULT 'Pending',
        due_date TEXT,
        FOREIGN KEY(room_id) REFERENCES event_rooms(id),
        FOREIGN KEY(reservation_id) REFERENCES reservations(id)
    )`);

    // ── Reservation Ledger (Payments) ──────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS reservation_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reservation_id INTEGER,
        amount REAL,
        payment_type TEXT,
        status TEXT DEFAULT 'Pending',
        due_date TEXT,
        paid_date TEXT,
        FOREIGN KEY(reservation_id) REFERENCES reservations(id)
    )`);

});

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION API
// ═══════════════════════════════════════════════════════════
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    try {
        const user = await getOne("SELECT id, username, role, name FROM users WHERE username = ? AND password = ?", [username, password]);
        if (!user) return res.status(401).json({ error: "Invalid username or password" });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

db.serialize(() => {
    // ── Event Equipment & Services ──────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS event_equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price_per_day REAL,
        total_quantity INTEGER,
        type TEXT
    )`);

    // ── Reservation Equipment Map ──────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS reservation_equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reservation_id INTEGER,
        equipment_id INTEGER,
        quantity INTEGER,
        price_at_time REAL,
        FOREIGN KEY(reservation_id) REFERENCES reservations(id),
        FOREIGN KEY(equipment_id) REFERENCES event_equipment(id)
    )`);

    // ── Master Bookings (Group Bookings) ──────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS master_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        master_event_name TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        status TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`);

    // ── Inquiries Table ───────────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ref_no TEXT UNIQUE,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT,
        event_type TEXT,
        preferred_date TEXT,
        flexible_date INTEGER DEFAULT 0,
        num_guests INTEGER,
        preferred_room_id INTEGER,
        budget REAL,
        requirements TEXT,
        source TEXT DEFAULT 'Walk-in',
        status TEXT DEFAULT 'New',
        assigned_to TEXT,
        follow_up_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        menu_selections TEXT,
        FOREIGN KEY(preferred_room_id) REFERENCES event_rooms(id)
    )`);

    // Seed event rooms if table is empty
    db.get("SELECT COUNT(*) as count FROM event_rooms", (err, row) => {
        if (!err && row.count === 0) {
            db.run("INSERT INTO event_rooms (name, capacity, price_per_day, type, status) VALUES ('Araliya Grand Banquet', 200, 50000.00, 'Banquet', 'Available')");
            db.run("INSERT INTO event_rooms (name, capacity, price_per_day, type, status) VALUES ('Sigiri Boardroom', 20, 15000.00, 'Meeting', 'Available')");
            db.run("INSERT INTO event_rooms (name, capacity, price_per_day, type, status) VALUES ('Samanala Rooftop Terrace', 100, 30000.00, 'Outdoor', 'Available')");
        }
    });
});

// ═══════════════════════════════════════════════════════════
// INQUIRIES API
// ═══════════════════════════════════════════════════════════

// Generate reference number
function generateRef() {
    const now = new Date();
    return `INQ-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Generate booking number
function generateBookingNo() {
    const now = new Date();
    return `BKG-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// GET all inquiries
app.get('/api/inquiries', async (req, res) => {
    try {
        const rows = await allQuery(`
            SELECT i.*, e.name as room_name
            FROM inquiries i
            LEFT JOIN event_rooms e ON i.preferred_room_id = e.id
            ORDER BY i.created_at DESC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single inquiry
app.get('/api/inquiries/:id', async (req, res) => {
    try {
        const row = await getOne(`
            SELECT i.*, e.name as room_name
            FROM inquiries i
            LEFT JOIN event_rooms e ON i.preferred_room_id = e.id
            WHERE i.id = ?
        `, [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create inquiry
app.post('/api/inquiries', async (req, res) => {
    const { customer_name, customer_phone, customer_email, event_type, preferred_date,
            flexible_date, num_guests, preferred_room_id, budget, requirements,
            source, assigned_to, follow_up_date, notes, menu_selections } = req.body;
    if (!customer_name) return res.status(400).json({ error: 'Customer name is required' });
    if (!customer_phone && !customer_email) return res.status(400).json({ error: 'At least one contact method is required' });
    if (customer_phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(customer_phone)) return res.status(400).json({ error: 'Invalid phone number format' });
    if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) return res.status(400).json({ error: 'Invalid email format' });
    if (budget && isNaN(budget)) return res.status(400).json({ error: 'Budget must be a number' });
    if (num_guests && isNaN(num_guests)) return res.status(400).json({ error: 'Guests must be a number' });
    try {
        const ref_no = generateRef();
        const result = await runQuery(`
            INSERT INTO inquiries
            (ref_no, customer_name, customer_phone, customer_email, event_type,
             preferred_date, flexible_date, num_guests, preferred_room_id,
             budget, requirements, source, status, assigned_to, follow_up_date, notes,
             menu_selections, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'New',?,?,?,?,datetime('now'),datetime('now'))
        `, [ref_no, customer_name, customer_phone, customer_email, event_type,
            preferred_date, flexible_date ? 1 : 0, num_guests, preferred_room_id || null,
            budget, requirements, source || 'Walk-in', assigned_to, follow_up_date, notes,
            menu_selections ? JSON.stringify(menu_selections) : null]);
        const inquiry = await getOne(`SELECT i.*, e.name as room_name FROM inquiries i LEFT JOIN event_rooms e ON i.preferred_room_id = e.id WHERE i.id = ?`, [result.lastID]);
        res.status(201).json(inquiry);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update inquiry
app.put('/api/inquiries/:id', async (req, res) => {
    const { customer_name, customer_phone, customer_email, event_type, preferred_date,
            flexible_date, num_guests, preferred_room_id, budget, requirements,
            source, status, assigned_to, follow_up_date, notes, menu_selections } = req.body;
    if (!customer_name) return res.status(400).json({ error: 'Customer name is required' });
    if (!customer_phone && !customer_email) return res.status(400).json({ error: 'At least one contact method is required' });
    if (customer_phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(customer_phone)) return res.status(400).json({ error: 'Invalid phone number format' });
    if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) return res.status(400).json({ error: 'Invalid email format' });
    if (budget && isNaN(budget)) return res.status(400).json({ error: 'Budget must be a number' });
    if (num_guests && isNaN(num_guests)) return res.status(400).json({ error: 'Guests must be a number' });
    try {
        await runQuery(`
            UPDATE inquiries SET
            customer_name=?, customer_phone=?, customer_email=?, event_type=?,
            preferred_date=?, flexible_date=?, num_guests=?, preferred_room_id=?,
            budget=?, requirements=?, source=?, status=?, assigned_to=?,
            follow_up_date=?, notes=?, menu_selections=?, updated_at=datetime('now')
            WHERE id=?
        `, [customer_name, customer_phone, customer_email, event_type,
            preferred_date, flexible_date ? 1 : 0, num_guests, preferred_room_id || null,
            budget, requirements, source, status, assigned_to, follow_up_date, notes,
            menu_selections ? JSON.stringify(menu_selections) : null, req.params.id]);
        const inquiry = await getOne(`SELECT i.*, e.name as room_name FROM inquiries i LEFT JOIN event_rooms e ON i.preferred_room_id = e.id WHERE i.id = ?`, [req.params.id]);
        res.json(inquiry);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH status only
app.patch('/api/inquiries/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    try {
        await runQuery("UPDATE inquiries SET status=?, updated_at=datetime('now') WHERE id=?", [status, req.params.id]);
        const inquiry = await getOne(`SELECT i.*, e.name as room_name FROM inquiries i LEFT JOIN event_rooms e ON i.preferred_room_id = e.id WHERE i.id = ?`, [req.params.id]);
        res.json(inquiry);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST convert inquiry → reservation
app.post('/api/inquiries/:id/convert', async (req, res) => {
    try {
        const inq = await getOne("SELECT * FROM inquiries WHERE id = ?", [req.params.id]);
        if (!inq) return res.status(404).json({ error: 'Inquiry not found' });

        const bookingNo = generateBookingNo();

        const resResult = await runQuery(`
            INSERT INTO reservations (booking_no, inquiry_ref_no, event_name, customer_name, customer_phone, room_id, date_start, num_guests, status, total_price, notes, menu_selections, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, datetime('now'))
        `, [bookingNo, inq.ref_no, inq.event_type || 'Event', inq.customer_name, inq.customer_phone,
            inq.preferred_room_id || null, inq.preferred_date, inq.num_guests,
            inq.budget, inq.requirements, inq.menu_selections]);

        await runQuery("UPDATE inquiries SET status='Converted', updated_at=datetime('now') WHERE id=?", [inq.id]);

        if (inq.preferred_room_id) {
            await runQuery("UPDATE event_rooms SET status='Booked' WHERE id=?", [inq.preferred_room_id]);
        }

        res.json({ success: true, reservation_id: resResult.lastID, booking_no: bookingNo, message: 'Inquiry converted to reservation' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE inquiry
app.delete('/api/inquiries/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM inquiries WHERE id=?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});



// ═══════════════════════════════════════════════════════════
// EVENT ROOMS API
// ═══════════════════════════════════════════════════════════

// GET all rooms
app.get('/api/event-rooms', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM event_rooms ORDER BY id ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create room
app.post('/api/event-rooms', async (req, res) => {
    const { name, capacity, price_per_day, type, status } = req.body;
    if (!name || !capacity || !price_per_day) {
        return res.status(400).json({ error: 'Name, capacity and price_per_day are required' });
    }
    if (isNaN(capacity) || capacity < 1) return res.status(400).json({ error: 'Capacity must be > 0' });
    if (isNaN(price_per_day) || price_per_day < 0) return res.status(400).json({ error: 'Price must be >= 0' });
    try {
        const result = await runQuery(
            "INSERT INTO event_rooms (name, capacity, price_per_day, type, status) VALUES (?, ?, ?, ?, ?)",
            [name, capacity, price_per_day, type || 'Banquet', status || 'Available']
        );
        const room = await getOne("SELECT * FROM event_rooms WHERE id = ?", [result.lastID]);
        res.status(201).json(room);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update room
app.put('/api/event-rooms/:id', async (req, res) => {
    const { name, capacity, price_per_day, type, status } = req.body;
    if (!name || !capacity || !price_per_day) {
        return res.status(400).json({ error: 'Name, capacity and price_per_day are required' });
    }
    if (isNaN(capacity) || capacity < 1) return res.status(400).json({ error: 'Capacity must be > 0' });
    if (isNaN(price_per_day) || price_per_day < 0) return res.status(400).json({ error: 'Price must be >= 0' });
    try {
        await runQuery(
            "UPDATE event_rooms SET name=?, capacity=?, price_per_day=?, type=?, status=? WHERE id=?",
            [name, capacity, price_per_day, type, status, req.params.id]
        );
        const room = await getOne("SELECT * FROM event_rooms WHERE id = ?", [req.params.id]);
        res.json(room);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE room
app.delete('/api/event-rooms/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM event_rooms WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
// RESERVATIONS API
// ═══════════════════════════════════════════════════════════

// GET all reservations (with room name joined)
app.get('/api/reservations', async (req, res) => {
    try {
        const rows = await allQuery(`
            SELECT r.*, e.name as room_name, e.type as room_type, e.price_per_day
            FROM reservations r
            LEFT JOIN event_rooms e ON r.room_id = e.id
            ORDER BY r.date_start DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single reservation
app.get('/api/reservations/:id', async (req, res) => {
    try {
        const row = await getOne(`
            SELECT r.*, e.name as room_name
            FROM reservations r
            LEFT JOIN event_rooms e ON r.room_id = e.id
            WHERE r.id = ?
        `, [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create reservation + update room status
app.post('/api/reservations', async (req, res) => {
    const { booking_no, inquiry_ref_no, event_name, customer_name, customer_phone, room_id, date_start, date_end, num_guests, status, total_price, notes, menu_selections, pax_size, function_type, event_type, package_type, meal_type, start_time, end_time, meal_time, children_count, description } = req.body;
    if (!event_name || !customer_name || !date_start) {
        return res.status(400).json({ error: 'Event name, customer name and date_start are required' });
    }
    if (customer_phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(customer_phone)) return res.status(400).json({ error: 'Invalid phone number format' });
    if (date_end && new Date(date_start) > new Date(date_end)) return res.status(400).json({ error: 'End date cannot be before start date' });
    if (num_guests && (isNaN(num_guests) || num_guests < 1)) return res.status(400).json({ error: 'Guests must be at least 1' });
    if (total_price && (isNaN(total_price) || total_price < 0)) return res.status(400).json({ error: 'Total price cannot be negative' });
    
    const finalBookingNo = booking_no || generateBookingNo();
    try {
        if (room_id && status === 'Confirmed') {
            const room = await getOne("SELECT * FROM event_rooms WHERE id = ?", [room_id]);
            if (room) {
                const setupBuffer = room.setup_buffer_hours || 0;
                const cleanupBuffer = room.cleanup_buffer_hours || 0;
                const existing = await allQuery("SELECT * FROM reservations WHERE room_id = ? AND status = 'Confirmed'", [room_id]);
                
                for (let r of existing) {
                    const rStart = new Date(r.date_start);
                    const rEnd = new Date(r.date_end || r.date_start);
                    rStart.setHours(rStart.getHours() - setupBuffer);
                    rEnd.setHours(rEnd.getHours() + cleanupBuffer);
                    
                    const newStart = new Date(date_start);
                    const newEnd = new Date(date_end || date_start);
                    newStart.setHours(newStart.getHours() - setupBuffer);
                    newEnd.setHours(newEnd.getHours() + cleanupBuffer);
                    
                    if (newStart <= rEnd && newEnd >= rStart) {
                        return res.status(409).json({ error: 'Room unavailable: Conflicts with existing booking or required turnaround buffers.' });
                    }
                }
            }
        }

        const result = await runQuery(
            `INSERT INTO reservations (booking_no, inquiry_ref_no, event_name, customer_name, customer_phone, room_id, date_start, date_end, num_guests, status, total_price, notes, menu_selections, pax_size, function_type, event_type, package_type, meal_type, start_time, end_time, meal_time, children_count, description, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [finalBookingNo, inquiry_ref_no || null, event_name, customer_name, customer_phone, room_id || null, date_start, date_end, num_guests, status || 'Draft', total_price, notes || null, menu_selections ? JSON.stringify(menu_selections) : null, pax_size || null, function_type || null, event_type || null, package_type || null, meal_type || null, start_time || null, end_time || null, meal_time || null, children_count || null, description || null]
        );

        // If confirmed, mark room as booked and seed default maintenance/buffer tasks
        if ((status === 'Confirmed') && room_id) {
            await runQuery("UPDATE event_rooms SET status = 'Booked' WHERE id = ?", [room_id]);
            await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Pre-event Venue Setup', 'Pending')", [room_id, result.lastID]);
            await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'AV sound and display systems check', 'Pending')", [room_id, result.lastID]);
            await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Post-event cleaning and buffer preparation', 'Pending')", [room_id, result.lastID]);
        } else if (status === 'Pending Finance') {
            const msg = `New Booking #${finalBookingNo} requires finance approval.`;
            await runQuery("INSERT INTO notifications (role, message) VALUES (?, ?)", ['finance', msg]);
            io.emit('new_notification', { role: 'finance', message: msg });
            io.emit('data_updated');
        }

        const row = await getOne(`
            SELECT r.*, e.name as room_name
            FROM reservations r LEFT JOIN event_rooms e ON r.room_id = e.id
            WHERE r.id = ?
        `, [result.lastID]);
        res.status(201).json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update reservation status (confirm, cancel, etc.)
app.put('/api/reservations/:id', async (req, res) => {
    const { booking_no, inquiry_ref_no, event_name, customer_name, customer_phone, room_id, date_start, date_end, num_guests, status, total_price, notes, menu_selections, pax_size, function_type, event_type, package_type, meal_type, start_time, end_time, meal_time, children_count, description } = req.body;
    if (!event_name || !customer_name || !date_start) {
        return res.status(400).json({ error: 'Event name, customer name and date_start are required' });
    }
    if (customer_phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(customer_phone)) return res.status(400).json({ error: 'Invalid phone number format' });
    if (date_end && new Date(date_start) > new Date(date_end)) return res.status(400).json({ error: 'End date cannot be before start date' });
    if (num_guests && (isNaN(num_guests) || num_guests < 1)) return res.status(400).json({ error: 'Guests must be at least 1' });
    if (total_price && (isNaN(total_price) || total_price < 0)) return res.status(400).json({ error: 'Total price cannot be negative' });
    try {
        // Get old record to see if room needs to be freed
        const old = await getOne("SELECT * FROM reservations WHERE id = ?", [req.params.id]);

        if (room_id && status === 'Confirmed') {
            const room = await getOne("SELECT * FROM event_rooms WHERE id = ?", [room_id]);
            if (room) {
                const setupBuffer = room.setup_buffer_hours || 0;
                const cleanupBuffer = room.cleanup_buffer_hours || 0;
                const existing = await allQuery("SELECT * FROM reservations WHERE room_id = ? AND status = 'Confirmed' AND id != ?", [room_id, req.params.id]);
                
                for (let r of existing) {
                    const rStart = new Date(r.date_start);
                    const rEnd = new Date(r.date_end || r.date_start);
                    rStart.setHours(rStart.getHours() - setupBuffer);
                    rEnd.setHours(rEnd.getHours() + cleanupBuffer);
                    
                    const newStart = new Date(date_start);
                    const newEnd = new Date(date_end || date_start);
                    newStart.setHours(newStart.getHours() - setupBuffer);
                    newEnd.setHours(newEnd.getHours() + cleanupBuffer);
                    
                    if (newStart <= rEnd && newEnd >= rStart) {
                        return res.status(409).json({ error: 'Room unavailable: Conflicts with existing booking or required turnaround buffers.' });
                    }
                }
            }
        }

        await runQuery(
            `UPDATE reservations SET booking_no=?, inquiry_ref_no=?, event_name=?, customer_name=?, customer_phone=?, room_id=?, date_start=?, date_end=?, num_guests=?, status=?, total_price=?, notes=?, menu_selections=?, pax_size=?, function_type=?, event_type=?, package_type=?, meal_type=?, start_time=?, end_time=?, meal_time=?, children_count=?, description=?
             WHERE id=?`,
            [booking_no || old.booking_no, inquiry_ref_no || old.inquiry_ref_no, event_name, customer_name, customer_phone, room_id, date_start, date_end, num_guests, status, total_price, notes, menu_selections !== undefined ? JSON.stringify(menu_selections) : old.menu_selections, pax_size !== undefined ? pax_size : old.pax_size, function_type !== undefined ? function_type : old.function_type, event_type !== undefined ? event_type : old.event_type, package_type !== undefined ? package_type : old.package_type, meal_type !== undefined ? meal_type : old.meal_type, start_time !== undefined ? start_time : old.start_time, end_time !== undefined ? end_time : old.end_time, meal_time !== undefined ? meal_time : old.meal_time, children_count !== undefined ? children_count : old.children_count, description !== undefined ? description : old.description, req.params.id]
        );

        let promoted = null;
        // Sync room status based on reservation status changes
        if (old && old.room_id) {
            if (status === 'Confirmed') {
                await runQuery("UPDATE event_rooms SET status = 'Booked' WHERE id = ?", [old.room_id]);
                const existing = await allQuery("SELECT id FROM maintenance_tasks WHERE reservation_id = ?", [req.params.id]);
                if (existing.length === 0) {
                    await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Pre-event Venue Setup', 'Pending')", [old.room_id, req.params.id]);
                    await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'AV sound and display systems check', 'Pending')", [old.room_id, req.params.id]);
                    await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Post-event cleaning and buffer preparation', 'Pending')", [old.room_id, req.params.id]);
                }
            } else if (status === 'Cancelled') {
                // Check if any other confirmed reservations use this room
                const others = await allQuery(
                    "SELECT id FROM reservations WHERE room_id = ? AND status = 'Confirmed' AND id != ?",
                    [old.room_id, req.params.id]
                );
                if (others.length === 0) {
                    await runQuery("UPDATE event_rooms SET status = 'Available' WHERE id = ?", [old.room_id]);
                }
                promoted = await promoteWaitlistIfAny(old.room_id);
            }
        }

        const updated = await getOne(`
            SELECT r.*, e.name as room_name
            FROM reservations r LEFT JOIN event_rooms e ON r.room_id = e.id
            WHERE r.id = ?
        `, [req.params.id]);
        if (promoted) updated.promoted = promoted;
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH — quick status-only update
app.patch('/api/reservations/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    try {
        const old = await getOne("SELECT * FROM reservations WHERE id = ?", [req.params.id]);
        await runQuery("UPDATE reservations SET status = ? WHERE id = ?", [status, req.params.id]);

        let promoted = null;
        // Sync room status
        if (old && old.room_id) {
            if (status === 'Confirmed') {
                await runQuery("UPDATE event_rooms SET status = 'Booked' WHERE id = ?", [old.room_id]);
                const existing = await allQuery("SELECT id FROM maintenance_tasks WHERE reservation_id = ?", [req.params.id]);
                if (existing.length === 0) {
                    await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Pre-event Venue Setup', 'Pending')", [old.room_id, req.params.id]);
                    await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'AV sound and display systems check', 'Pending')", [old.room_id, req.params.id]);
                    await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Post-event cleaning and buffer preparation', 'Pending')", [old.room_id, req.params.id]);
                }
            } else if (status === 'Cancelled') {
                const others = await allQuery(
                    "SELECT id FROM reservations WHERE room_id = ? AND status = 'Confirmed' AND id != ?",
                    [old.room_id, req.params.id]
                );
                if (others.length === 0) {
                    await runQuery("UPDATE event_rooms SET status = 'Available' WHERE id = ?", [old.room_id]);
                }
                promoted = await promoteWaitlistIfAny(old.room_id);
            }
        }

        if (status === 'Pending Finance') {
            const msg = `Booking #${old.booking_no || old.id} requires finance approval.`;
            await runQuery("INSERT INTO notifications (role, message) VALUES (?, ?)", ['finance', msg]);
            io.emit('new_notification', { role: 'finance', message: msg });
        }
        io.emit('data_updated');

        const updated = await getOne(`
            SELECT r.*, e.name as room_name
            FROM reservations r LEFT JOIN event_rooms e ON r.room_id = e.id
            WHERE r.id = ?
        `, [req.params.id]);
        if (promoted) updated.promoted = promoted;
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE reservation + free room
app.delete('/api/reservations/:id', async (req, res) => {
    try {
        const old = await getOne("SELECT * FROM reservations WHERE id = ?", [req.params.id]);
        await runQuery("DELETE FROM reservations WHERE id = ?", [req.params.id]);

        let promoted = null;
        // Free the room if no other confirmed bookings for it
        if (old && old.room_id) {
            const others = await allQuery(
                "SELECT id FROM reservations WHERE room_id = ? AND status = 'Confirmed'",
                [old.room_id]
            );
            if (others.length === 0) {
                await runQuery("UPDATE event_rooms SET status = 'Available' WHERE id = ?", [old.room_id]);
            }
            promoted = await promoteWaitlistIfAny(old.room_id);
        }
        res.json({ success: true, promoted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
// CUSTOMERS API
// ═══════════════════════════════════════════════════════════

// GET all customers
app.get('/api/customers', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM customers ORDER BY name ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single customer
app.get('/api/customers/:id', async (req, res) => {
    try {
        const row = await getOne("SELECT * FROM customers WHERE id = ?", [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers', async (req, res) => {
    const { name, phone, email, customer_type, contact_person, contact_person_phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name is required' });
    if (!phone) return res.status(400).json({ error: 'Customer phone is required' });
    if (phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number format' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    try {
        const result = await runQuery(
            "INSERT INTO customers (name, phone, email, loyalty_points, total_spent, customer_type, contact_person, contact_person_phone) VALUES (?, ?, ?, 0, 0, ?, ?, ?)",
            [name, phone || '', email || '', customer_type || 'Personal', contact_person || null, contact_person_phone || null]
        );
        const customer = await getOne("SELECT * FROM customers WHERE id = ?", [result.lastID]);
        res.status(201).json(customer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update customer
app.put('/api/customers/:id', async (req, res) => {
    const { name, phone, email, customer_type, contact_person, contact_person_phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name is required' });
    if (!phone) return res.status(400).json({ error: 'Customer phone is required' });
    if (phone && !/^\+?[0-9\s\-\(\)]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number format' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    try {
        await runQuery(
            "UPDATE customers SET name=?, phone=?, email=?, customer_type=?, contact_person=?, contact_person_phone=? WHERE id=?",
            [name, phone, email, customer_type, contact_person, contact_person_phone, req.params.id]
        );
        const customer = await getOne("SELECT * FROM customers WHERE id = ?", [req.params.id]);
        res.json(customer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE customer
app.delete('/api/customers/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM customers WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════
// WAITLIST API
// ═══════════════════════════════════════════════════════════

app.get('/api/waitlist', async (req, res) => {
    try {
        const rows = await allQuery(`
            SELECT w.*, e.name as room_name 
            FROM waitlist w
            LEFT JOIN event_rooms e ON w.room_id = e.id
            ORDER BY w.created_at ASC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/waitlist', async (req, res) => {
    const { room_id, customer_name, customer_phone, date_start, date_end, num_guests, event_name, notes } = req.body;
    if (!customer_name) return res.status(400).json({ error: 'Customer name is required' });
    if (!room_id) return res.status(400).json({ error: 'Room selection is required' });
    try {
        const result = await runQuery(`
            INSERT INTO waitlist (room_id, customer_name, customer_phone, date_start, date_end, num_guests, event_name, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [room_id, customer_name, customer_phone, date_start, date_end, num_guests, event_name, notes]);
        const entry = await getOne(`
            SELECT w.*, e.name as room_name FROM waitlist w LEFT JOIN event_rooms e ON w.room_id = e.id WHERE w.id = ?
        `, [result.lastID]);
        res.status(201).json(entry);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/waitlist/:id', async (req, res) => {
    try {
        await runQuery("DELETE FROM waitlist WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═══════════════════════════════════════════════════════════
// MAINTENANCE TASKS API
// ═══════════════════════════════════════════════════════════

app.get('/api/maintenance-tasks', async (req, res) => {
    try {
        const rows = await allQuery(`
            SELECT m.*, e.name as room_name, r.event_name
            FROM maintenance_tasks m
            LEFT JOIN event_rooms e ON m.room_id = e.id
            LEFT JOIN reservations r ON m.reservation_id = r.id
            ORDER BY m.id DESC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/maintenance-tasks', async (req, res) => {
    const { room_id, reservation_id, task_name, status, due_date } = req.body;
    if (!task_name) return res.status(400).json({ error: 'Task name is required' });
    if (!room_id) return res.status(400).json({ error: 'Room selection is required' });
    try {
        const result = await runQuery(`
            INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status, due_date)
            VALUES (?, ?, ?, ?, ?)
        `, [room_id, reservation_id || null, task_name, status || 'Pending', due_date || null]);
        
        if ((status || 'Pending') === 'Pending') {
            await runQuery("UPDATE event_rooms SET status = 'Maintenance' WHERE id = ?", [room_id]);
        }

        const task = await getOne("SELECT * FROM maintenance_tasks WHERE id = ?", [result.lastID]);
        res.status(201).json(task);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/maintenance-tasks/:id', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    try {
        await runQuery("UPDATE maintenance_tasks SET status = ? WHERE id = ?", [status, req.params.id]);
        const task = await getOne("SELECT * FROM maintenance_tasks WHERE id = ?", [req.params.id]);
        
        if (status === 'Completed' && task.room_id) {
            const activeTasks = await allQuery("SELECT id FROM maintenance_tasks WHERE room_id = ? AND status = 'Pending'", [task.room_id]);
            if (activeTasks.length === 0) {
                const confirmedNow = await allQuery(`
                    SELECT id FROM reservations 
                    WHERE room_id = ? 
                      AND status = 'Confirmed' 
                      AND date('now') BETWEEN date(date_start) AND date(COALESCE(date_end, date_start))
                `, [task.room_id]);
                const newStatus = confirmedNow.length > 0 ? 'Booked' : 'Available';
                await runQuery("UPDATE event_rooms SET status = ? WHERE id = ?", [newStatus, task.room_id]);
            }
        } else if (status === 'Pending' && task.room_id) {
            await runQuery("UPDATE event_rooms SET status = 'Maintenance' WHERE id = ?", [task.room_id]);
        }

        res.json(task);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═══════════════════════════════════════════════════════════
// SETTINGS API
// ═══════════════════════════════════════════════════════════

app.get('/api/settings', async (req, res) => {
    try {
        await runQuery(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
        const rows = await allQuery("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings', async (req, res) => {
    const settings = req.body;
    try {
        await runQuery(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
        for (const [key, value] of Object.entries(settings)) {
            await runQuery("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═══════════════════════════════════════════════════════════
// E-SIGNATURES API
// ═══════════════════════════════════════════════════════════

app.patch('/api/reservations/:id/signature', async (req, res) => {
    const { signature_data } = req.body;
    if (!signature_data) return res.status(400).json({ error: 'signature_data is required' });
    try {
        await runQuery("UPDATE reservations SET signature_data = ? WHERE id = ?", [signature_data, req.params.id]);
        res.json({ success: true, message: 'Signature updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═══════════════════════════════════════════════════════════
// LEDGER (PAYMENTS) API
// ═══════════════════════════════════════════════════════════
app.get('/api/reservations/:id/ledger', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM reservation_ledger WHERE reservation_id = ? ORDER BY id ASC", [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reservations/:id/ledger', async (req, res) => {
    const { amount, payment_type, due_date } = req.body;
    try {
        const result = await runQuery(`
            INSERT INTO reservation_ledger (reservation_id, amount, payment_type, due_date)
            VALUES (?, ?, ?, ?)
        `, [req.params.id, amount, payment_type, due_date || null]);
        const entry = await getOne("SELECT * FROM reservation_ledger WHERE id = ?", [result.lastID]);
        res.status(201).json(entry);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/ledger/:id/pay', async (req, res) => {
    try {
        await runQuery("UPDATE reservation_ledger SET status = 'Paid', paid_date = datetime('now') WHERE id = ?", [req.params.id]);
        const entry = await getOne("SELECT * FROM reservation_ledger WHERE id = ?", [req.params.id]);
        res.json(entry);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reservations/:id/orders', async (req, res) => {
    try {
        const orders = await allQuery("SELECT * FROM orders WHERE reservation_id = ?", [req.params.id]);
        if (orders.length === 0) return res.json([]);
        const orderIds = orders.map(o => `'${o.id}'`).join(',');
        const items = await allQuery(`
            SELECT oi.*, d.name as dish_name 
            FROM order_items oi 
            LEFT JOIN dishes d ON oi.dish_id = d.id 
            WHERE oi.order_id IN (${orderIds})
        `);
        orders.forEach(o => {
            o.items = items.filter(i => i.order_id === o.id);
        });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reservations/:id/advance_payment', async (req, res) => {
    const { amount } = req.body;
    try {
        // Insert ledger
        await runQuery(`
            INSERT INTO reservation_ledger (reservation_id, amount, payment_type, status, paid_date)
            VALUES (?, ?, 'Advance Payment', 'Paid', datetime('now'))
        `, [req.params.id, amount]);
        // Update reservation
        await runQuery("UPDATE reservations SET status = 'Pending Finance' WHERE id = ?", [req.params.id]);
        
        // Notify finance
        const msg = `Booking #${req.params.id} has made an advance payment of ${amount}. Pending your approval.`;
        await runQuery("INSERT INTO notifications (role, message) VALUES (?, ?)", ['finance', msg]);
        io.emit('new_notification', { role: 'finance', message: msg });
        io.emit('data_updated');

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reservations/:id/finance_approve', async (req, res) => {
    try {
        const { payment_slip, amount } = req.body;
        const old = await getOne("SELECT * FROM reservations WHERE id = ?", [req.params.id]);
        if (!old) return res.status(404).json({ error: 'Not found' });
        
        await runQuery(`
            INSERT INTO reservation_ledger (reservation_id, amount, payment_type, status, paid_date)
            VALUES (?, ?, 'Advance Payment', 'Paid', datetime('now'))
        `, [req.params.id, amount]);

        await runQuery("UPDATE reservations SET status = 'Confirmed', payment_slip = ? WHERE id = ?", [payment_slip || null, req.params.id]);
        
        // Notify admin
        const msg = `Finance team approved Booking #${old.booking_no || old.id}. Advance payment slip attached.`;
        await runQuery("INSERT INTO notifications (role, message) VALUES (?, ?)", ['admin', msg]);
        io.emit('new_notification', { role: 'admin', message: msg });
        io.emit('data_updated'); // Trigger refresh across clients
        
        if (old.room_id) {
            await runQuery("UPDATE event_rooms SET status = 'Booked' WHERE id = ?", [old.room_id]);
            const existing = await allQuery("SELECT id FROM maintenance_tasks WHERE reservation_id = ?", [req.params.id]);
            if (existing.length === 0) {
                await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Pre-event Venue Setup', 'Pending')", [old.room_id, req.params.id]);
                await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'AV sound and display systems check', 'Pending')", [old.room_id, req.params.id]);
                await runQuery("INSERT INTO maintenance_tasks (room_id, reservation_id, task_name, status) VALUES (?, ?, 'Post-event cleaning and buffer preparation', 'Pending')", [old.room_id, req.params.id]);
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS API
// ═══════════════════════════════════════════════════════════
app.get('/api/notifications', async (req, res) => {
    try {
        const role = req.query.role || 'admin';
        const notifs = await allQuery("SELECT * FROM notifications WHERE role = ? AND is_read = 0 ORDER BY created_at DESC", [role]);
        res.json({ notifications: notifs });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notifications/:id/mark_read', async (req, res) => {
    try {
        await runQuery("UPDATE notifications SET is_read = 1 WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// EQUIPMENT & SERVICES API
// ═══════════════════════════════════════════════════════════
app.get('/api/equipment', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM event_equipment ORDER BY type ASC");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reservations/:id/equipment', async (req, res) => {
    try {
        const rows = await allQuery(`
            SELECT re.*, e.name, e.type 
            FROM reservation_equipment re
            JOIN event_equipment e ON re.equipment_id = e.id
            WHERE re.reservation_id = ?
        `, [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reservations/:id/equipment', async (req, res) => {
    const { equipment_id, quantity, price_at_time } = req.body;
    try {
        const result = await runQuery(`
            INSERT INTO reservation_equipment (reservation_id, equipment_id, quantity, price_at_time)
            VALUES (?, ?, ?, ?)
        `, [req.params.id, equipment_id, quantity, price_at_time]);
        const entry = await getOne(`
            SELECT re.*, e.name, e.type 
            FROM reservation_equipment re
            JOIN event_equipment e ON re.equipment_id = e.id
            WHERE re.id = ?
        `, [result.lastID]);
        res.status(201).json(entry);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// MASTER BOOKINGS (GROUP BOOKINGS) API
// ═══════════════════════════════════════════════════════════
app.get('/api/master-bookings', async (req, res) => {
    try {
        const rows = await allQuery("SELECT * FROM master_bookings ORDER BY created_at DESC");
        // For each master booking, get its reservations
        for (let mb of rows) {
            mb.reservations = await allQuery("SELECT r.*, e.name as room_name FROM reservations r LEFT JOIN event_rooms e ON r.room_id = e.id WHERE r.master_booking_id = ?", [mb.id]);
        }
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/master-bookings', async (req, res) => {
    const { master_event_name, customer_name, customer_phone, status } = req.body;
    try {
        const result = await runQuery(`
            INSERT INTO master_bookings (master_event_name, customer_name, customer_phone, status)
            VALUES (?, ?, ?, ?)
        `, [master_event_name, customer_name, customer_phone, status || 'Pending']);
        const mb = await getOne("SELECT * FROM master_bookings WHERE id = ?", [result.lastID]);
        mb.reservations = [];
        res.status(201).json(mb);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// BACKGROUND CRON JOBS (Yield Management / Automated Cancel)
// ═══════════════════════════════════════════════════════════
setInterval(async () => {
    try {
        // Find pending reservations older than 48 hours
        const oldPendings = await allQuery(`
            SELECT id, room_id FROM reservations 
            WHERE status = 'Pending' 
            AND created_at < datetime('now', '-48 hours')
        `);

        for (let r of oldPendings) {
            // Check if they paid any deposit
            const paidDeposits = await allQuery("SELECT id FROM reservation_ledger WHERE reservation_id = ? AND status = 'Paid'", [r.id]);
            if (paidDeposits.length === 0) {
                // Cancel them
                await runQuery("UPDATE reservations SET status = 'Cancelled', notes = coalesce(notes, '') || ' (Auto-cancelled: 48h timeout)' WHERE id = ?", [r.id]);
                console.log(`Auto-cancelled reservation ${r.id} due to 48h timeout without deposit.`);
                // Promote next in waitlist
                if (r.room_id) {
                    await promoteWaitlistIfAny(r.room_id);
                }
            }
        }
    } catch (err) {
        console.error("Error in Yield Management cron:", err);
    }
}, 60 * 60 * 1000); // Check every hour


// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = 302;
app.listen(PORT, () => {
    console.log(`✅ Reservation Server running on http://localhost:${PORT}`);
});
