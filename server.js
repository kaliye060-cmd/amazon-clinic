const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Create data folder if it doesn't exist
const dataDir = './data';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

// --- Database ---
const db = new sqlite3.Database('./data/clinic.db', (err) => {
    if (err) console.error('DB error:', err.message);
    else console.log('Connected to SQLite database.');
});

// --- Create tables and admin user ---
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // Delete any existing admin and create new one with password 12345
    db.run("DELETE FROM users WHERE username = 'admin'");
    db.run("INSERT INTO users (username, password) VALUES ('admin', '12345')");
    console.log('✅ Admin created with password: 12345');

    // Other tables (simplified)
    db.run(`CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, email TEXT, phone TEXT, department TEXT,
        specialty TEXT, qualifications TEXT, experience INTEGER,
        bio TEXT, languages TEXT, fee REAL,
        workingDays TEXT, workingHours TEXT,
        isAvailable INTEGER DEFAULT 1,
        isFeatured INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0,
        photo TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, description TEXT, icon TEXT, isActive INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patientName TEXT, content TEXT, rating INTEGER,
        isApproved INTEGER DEFAULT 0, isArchived INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS healthPackages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, price REAL, features TEXT, isActive INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS faqs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT, answer TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, icon TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS blogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, slug TEXT, excerpt TEXT, content TEXT,
        publishedAt TEXT, isPublished INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patientName TEXT, patientPhone TEXT, patientEmail TEXT,
        department TEXT, doctor TEXT, date TEXT, time TEXT,
        status TEXT DEFAULT 'PENDING', notes TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS contactInfo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT, phone TEXT, mobile TEXT, emergency TEXT,
        email TEXT, hours TEXT, mapEmbed TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patients TEXT, satisfaction TEXT, emergency TEXT
    )`);

    // Seed default data
    db.get("SELECT * FROM contactInfo LIMIT 1", (err, row) => {
        if (!row) {
            db.run(`INSERT INTO contactInfo (address, phone, mobile, emergency, email, hours, mapEmbed)
                VALUES (
                    'Arba Minch, Ethiopia',
                    '046 899 7555',
                    '0912 036 550',
                    '046 899 7555',
                    'contact@amazonclinic.com',
                    '24 Hours · 7 Days a Week',
                    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d31876.97507892743!2d37.540985!3d6.033333!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x17b0f5e8a3b4c8b7%3A0x8b3c4d5e6f7a8b9c!2sArba%20Minch%2C%20Ethiopia!5e0!3m2!1sen!2s!4v1700000000000'
                )
            `);
        }
    });

    db.get("SELECT * FROM stats LIMIT 1", (err, row) => {
        if (!row) {
            db.run("INSERT INTO stats (patients, satisfaction, emergency) VALUES ('10K+', '98%', '24/7')");
        }
    });
});

// --- Helper functions ---
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

// --- Routes ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
        if (user) {
            req.session.user = { id: user.id, username: user.username };
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/session', (req, res) => {
    if (req.session.user) res.json({ loggedIn: true, user: req.session.user });
    else res.json({ loggedIn: false });
});

// --- Doctor Routes ---
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await query("SELECT * FROM doctors");
        res.json(doctors);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/doctors', isAuthenticated, async (req, res) => {
    try {
        const { name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable, isFeatured, photo } = req.body;
        const result = await run(`
            INSERT INTO doctors (name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable, isFeatured, photo)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable || 1, isFeatured || 0, photo || '']);
        const doctor = await get("SELECT * FROM doctors WHERE id = ?", [result.lastID]);
        res.status(201).json(doctor);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/doctors/:id', isAuthenticated, async (req, res) => {
    try {
        const { name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable, isFeatured, isArchived, photo } = req.body;
        await run(`
            UPDATE doctors SET name=?, email=?, phone=?, department=?, specialty=?, qualifications=?, experience=?, bio=?, languages=?, fee=?, workingDays=?, workingHours=?, isAvailable=?, isFeatured=?, isArchived=?, photo=?
            WHERE id = ?
        `, [name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable, isFeatured, isArchived, photo, req.params.id]);
        const doctor = await get("SELECT * FROM doctors WHERE id = ?", [req.params.id]);
        res.json(doctor);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/doctors/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM doctors WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Service Routes ---
app.get('/api/services', async (req, res) => {
    try { const services = await query("SELECT * FROM services"); res.json(services); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/services', isAuthenticated, async (req, res) => {
    try {
        const { name, description, icon, isActive } = req.body;
        const result = await run("INSERT INTO services (name, description, icon, isActive) VALUES (?,?,?,?)", [name, description, icon, isActive || 1]);
        const service = await get("SELECT * FROM services WHERE id = ?", [result.lastID]);
        res.status(201).json(service);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/services/:id', isAuthenticated, async (req, res) => {
    try {
        const { name, description, icon, isActive } = req.body;
        await run("UPDATE services SET name=?, description=?, icon=?, isActive=? WHERE id=?", [name, description, icon, isActive, req.params.id]);
        const service = await get("SELECT * FROM services WHERE id = ?", [req.params.id]);
        res.json(service);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/services/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM services WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Testimonial Routes ---
app.get('/api/testimonials', async (req, res) => {
    try { const testimonials = await query("SELECT * FROM testimonials"); res.json(testimonials); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/testimonials', isAuthenticated, async (req, res) => {
    try {
        const { patientName, content, rating, isApproved } = req.body;
        const result = await run("INSERT INTO testimonials (patientName, content, rating, isApproved) VALUES (?,?,?,?)", [patientName, content, rating, isApproved || 0]);
        const testimonial = await get("SELECT * FROM testimonials WHERE id = ?", [result.lastID]);
        res.status(201).json(testimonial);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/testimonials/:id', isAuthenticated, async (req, res) => {
    try {
        const { patientName, content, rating, isApproved, isArchived } = req.body;
        await run("UPDATE testimonials SET patientName=?, content=?, rating=?, isApproved=?, isArchived=? WHERE id=?", [patientName, content, rating, isApproved, isArchived, req.params.id]);
        const testimonial = await get("SELECT * FROM testimonials WHERE id = ?", [req.params.id]);
        res.json(testimonial);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/testimonials/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM testimonials WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Department Routes ---
app.get('/api/departments', async (req, res) => {
    try { const depts = await query("SELECT * FROM departments"); res.json(depts); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/departments', isAuthenticated, async (req, res) => {
    try {
        const { name } = req.body;
        const result = await run("INSERT INTO departments (name) VALUES (?)", [name]);
        const dept = await get("SELECT * FROM departments WHERE id = ?", [result.lastID]);
        res.status(201).json(dept);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/departments/:id', isAuthenticated, async (req, res) => {
    try {
        const { name } = req.body;
        await run("UPDATE departments SET name=? WHERE id=?", [name, req.params.id]);
        const dept = await get("SELECT * FROM departments WHERE id = ?", [req.params.id]);
        res.json(dept);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/departments/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM departments WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Package Routes ---
app.get('/api/packages', async (req, res) => {
    try { const packages = await query("SELECT * FROM healthPackages"); res.json(packages); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/packages', isAuthenticated, async (req, res) => {
    try {
        const { title, price, features, isActive } = req.body;
        const result = await run("INSERT INTO healthPackages (title, price, features, isActive) VALUES (?,?,?,?)", [title, price, features, isActive || 1]);
        const pkg = await get("SELECT * FROM healthPackages WHERE id = ?", [result.lastID]);
        res.status(201).json(pkg);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/packages/:id', isAuthenticated, async (req, res) => {
    try {
        const { title, price, features, isActive } = req.body;
        await run("UPDATE healthPackages SET title=?, price=?, features=?, isActive=? WHERE id=?", [title, price, features, isActive, req.params.id]);
        const pkg = await get("SELECT * FROM healthPackages WHERE id = ?", [req.params.id]);
        res.json(pkg);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/packages/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM healthPackages WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FAQ Routes ---
app.get('/api/faqs', async (req, res) => {
    try { const faqs = await query("SELECT * FROM faqs"); res.json(faqs); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/faqs', isAuthenticated, async (req, res) => {
    try {
        const { question, answer } = req.body;
        const result = await run("INSERT INTO faqs (question, answer) VALUES (?,?)", [question, answer]);
        const faq = await get("SELECT * FROM faqs WHERE id = ?", [result.lastID]);
        res.status(201).json(faq);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/faqs/:id', isAuthenticated, async (req, res) => {
    try {
        const { question, answer } = req.body;
        await run("UPDATE faqs SET question=?, answer=? WHERE id=?", [question, answer, req.params.id]);
        const faq = await get("SELECT * FROM faqs WHERE id = ?", [req.params.id]);
        res.json(faq);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/faqs/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM faqs WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Appointment Routes ---
app.get('/api/appointments', isAuthenticated, async (req, res) => {
    try { const appointments = await query("SELECT * FROM appointments"); res.json(appointments); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/appointments', async (req, res) => {
    try {
        const { patientName, patientPhone, patientEmail, department, doctor, date, time, status, notes } = req.body;
        const result = await run("INSERT INTO appointments (patientName, patientPhone, patientEmail, department, doctor, date, time, status, notes) VALUES (?,?,?,?,?,?,?,?,?)", [patientName, patientPhone, patientEmail, department, doctor, date, time, status || 'PENDING', notes || '']);
        const appt = await get("SELECT * FROM appointments WHERE id = ?", [result.lastID]);
        res.status(201).json(appt);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/appointments/:id', isAuthenticated, async (req, res) => {
    try {
        const { patientName, patientPhone, patientEmail, department, doctor, date, time, status, notes } = req.body;
        await run("UPDATE appointments SET patientName=?, patientPhone=?, patientEmail=?, department=?, doctor=?, date=?, time=?, status=?, notes=? WHERE id=?", [patientName, patientPhone, patientEmail, department, doctor, date, time, status, notes, req.params.id]);
        const appt = await get("SELECT * FROM appointments WHERE id = ?", [req.params.id]);
        res.json(appt);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/appointments/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM appointments WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Contact Info ---
app.get('/api/contact', async (req, res) => {
    try { const contact = await get("SELECT * FROM contactInfo LIMIT 1"); res.json(contact || {}); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/contact', isAuthenticated, async (req, res) => {
    try {
        const { address, phone, mobile, emergency, email, hours, mapEmbed } = req.body;
        await run("UPDATE contactInfo SET address=?, phone=?, mobile=?, emergency=?, email=?, hours=?, mapEmbed=? WHERE id=1", [address, phone, mobile, emergency, email, hours, mapEmbed]);
        const contact = await get("SELECT * FROM contactInfo LIMIT 1");
        res.json(contact);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Stats ---
app.get('/api/stats', async (req, res) => {
    try { const stats = await get("SELECT * FROM stats LIMIT 1"); res.json(stats || {}); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/stats', isAuthenticated, async (req, res) => {
    try {
        const { patients, satisfaction, emergency } = req.body;
        await run("UPDATE stats SET patients=?, satisfaction=?, emergency=? WHERE id=1", [patients, satisfaction, emergency]);
        const stats = await get("SELECT * FROM stats LIMIT 1");
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- User management ---
app.get('/api/users', isAuthenticated, async (req, res) => {
    try { const users = await query("SELECT id, username FROM users"); res.json(users); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', isAuthenticated, async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await run("INSERT INTO users (username, password) VALUES (?,?)", [username, password]);
        res.status(201).json({ id: result.lastID, username });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM users WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Change Password ---
app.put('/api/users/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;
    try {
        const user = await get("SELECT * FROM users WHERE id = ?", [userId]);
        if (!user || user.password !== currentPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        await run("UPDATE users SET password = ? WHERE id = ?", [newPassword, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Gallery ---
app.get('/api/gallery', async (req, res) => {
    try { const gallery = await query("SELECT * FROM gallery"); res.json(gallery); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/gallery', isAuthenticated, async (req, res) => {
    try {
        const { title, icon } = req.body;
        const result = await run("INSERT INTO gallery (title, icon) VALUES (?,?)", [title, icon]);
        const item = await get("SELECT * FROM gallery WHERE id = ?", [result.lastID]);
        res.status(201).json(item);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/gallery/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM gallery WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Blogs ---
app.get('/api/blogs', async (req, res) => {
    try { const blogs = await query("SELECT * FROM blogs"); res.json(blogs); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/blogs', isAuthenticated, async (req, res) => {
    try {
        const { title, slug, excerpt, content, publishedAt, isPublished } = req.body;
        const result = await run("INSERT INTO blogs (title, slug, excerpt, content, publishedAt, isPublished) VALUES (?,?,?,?,?,?)", [title, slug, excerpt, content, publishedAt, isPublished || 0]);
        const blog = await get("SELECT * FROM blogs WHERE id = ?", [result.lastID]);
        res.status(201).json(blog);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/blogs/:id', isAuthenticated, async (req, res) => {
    try {
        const { title, slug, excerpt, content, publishedAt, isPublished } = req.body;
        await run("UPDATE blogs SET title=?, slug=?, excerpt=?, content=?, publishedAt=?, isPublished=? WHERE id=?", [title, slug, excerpt, content, publishedAt, isPublished, req.params.id]);
        const blog = await get("SELECT * FROM blogs WHERE id = ?", [req.params.id]);
        res.json(blog);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/blogs/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM blogs WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve frontend
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔑 Admin login: admin / 12345`);
});const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Create data folder if it doesn't exist
const dataDir = './data';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

// --- Database ---
const db = new sqlite3.Database('./data/clinic.db', (err) => {
    if (err) console.error('DB error:', err.message);
    else console.log('Connected to SQLite database.');
});

// --- Create tables and admin user ---
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // Delete any existing admin and create new one with password 12345
    db.run("DELETE FROM users WHERE username = 'admin'");
    db.run("INSERT INTO users (username, password) VALUES ('admin', '12345')");
    console.log('✅ Admin created with password: 12345');

    // Other tables (simplified)
    db.run(`CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, email TEXT, phone TEXT, department TEXT,
        specialty TEXT, qualifications TEXT, experience INTEGER,
        bio TEXT, languages TEXT, fee REAL,
        workingDays TEXT, workingHours TEXT,
        isAvailable INTEGER DEFAULT 1,
        isFeatured INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0,
        photo TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, description TEXT, icon TEXT, isActive INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patientName TEXT, content TEXT, rating INTEGER,
        isApproved INTEGER DEFAULT 0, isArchived INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS healthPackages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, price REAL, features TEXT, isActive INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS faqs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT, answer TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, icon TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS blogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, slug TEXT, excerpt TEXT, content TEXT,
        publishedAt TEXT, isPublished INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patientName TEXT, patientPhone TEXT, patientEmail TEXT,
        department TEXT, doctor TEXT, date TEXT, time TEXT,
        status TEXT DEFAULT 'PENDING', notes TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS contactInfo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT, phone TEXT, mobile TEXT, emergency TEXT,
        email TEXT, hours TEXT, mapEmbed TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patients TEXT, satisfaction TEXT, emergency TEXT
    )`);

    // Seed default data
    db.get("SELECT * FROM contactInfo LIMIT 1", (err, row) => {
        if (!row) {
            db.run(`INSERT INTO contactInfo (address, phone, mobile, emergency, email, hours, mapEmbed)
                VALUES (
                    'Arba Minch, Ethiopia',
                    '046 899 7555',
                    '0912 036 550',
                    '046 899 7555',
                    'contact@amazonclinic.com',
                    '24 Hours · 7 Days a Week',
                    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d31876.97507892743!2d37.540985!3d6.033333!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x17b0f5e8a3b4c8b7%3A0x8b3c4d5e6f7a8b9c!2sArba%20Minch%2C%20Ethiopia!5e0!3m2!1sen!2s!4v1700000000000'
                )
            `);
        }
    });

    db.get("SELECT * FROM stats LIMIT 1", (err, row) => {
        if (!row) {
            db.run("INSERT INTO stats (patients, satisfaction, emergency) VALUES ('10K+', '98%', '24/7')");
        }
    });
});

// --- Helper functions ---
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

// --- Routes ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
        if (user) {
            req.session.user = { id: user.id, username: user.username };
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/session', (req, res) => {
    if (req.session.user) res.json({ loggedIn: true, user: req.session.user });
    else res.json({ loggedIn: false });
});

// --- Doctor Routes ---
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await query("SELECT * FROM doctors");
        res.json(doctors);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/doctors', isAuthenticated, async (req, res) => {
    try {
        const { name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable, isFeatured, photo } = req.body;
        const result = await run(`
            INSERT INTO doctors (name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable, isFeatured, photo)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable || 1, isFeatured || 0, photo || '']);
        const doctor = await get("SELECT * FROM doctors WHERE id = ?", [result.lastID]);
        res.status(201).json(doctor);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/doctors/:id', isAuthenticated, async (req, res) => {
    try {
        const { name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable, isFeatured, isArchived, photo } = req.body;
        await run(`
            UPDATE doctors SET name=?, email=?, phone=?, department=?, specialty=?, qualifications=?, experience=?, bio=?, languages=?, fee=?, workingDays=?, workingHours=?, isAvailable=?, isFeatured=?, isArchived=?, photo=?
            WHERE id = ?
        `, [name, email, phone, department, specialty, qualifications, experience, bio, languages, fee, workingDays, workingHours, isAvailable, isFeatured, isArchived, photo, req.params.id]);
        const doctor = await get("SELECT * FROM doctors WHERE id = ?", [req.params.id]);
        res.json(doctor);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/doctors/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM doctors WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Service Routes ---
app.get('/api/services', async (req, res) => {
    try { const services = await query("SELECT * FROM services"); res.json(services); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/services', isAuthenticated, async (req, res) => {
    try {
        const { name, description, icon, isActive } = req.body;
        const result = await run("INSERT INTO services (name, description, icon, isActive) VALUES (?,?,?,?)", [name, description, icon, isActive || 1]);
        const service = await get("SELECT * FROM services WHERE id = ?", [result.lastID]);
        res.status(201).json(service);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/services/:id', isAuthenticated, async (req, res) => {
    try {
        const { name, description, icon, isActive } = req.body;
        await run("UPDATE services SET name=?, description=?, icon=?, isActive=? WHERE id=?", [name, description, icon, isActive, req.params.id]);
        const service = await get("SELECT * FROM services WHERE id = ?", [req.params.id]);
        res.json(service);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/services/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM services WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Testimonial Routes ---
app.get('/api/testimonials', async (req, res) => {
    try { const testimonials = await query("SELECT * FROM testimonials"); res.json(testimonials); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/testimonials', isAuthenticated, async (req, res) => {
    try {
        const { patientName, content, rating, isApproved } = req.body;
        const result = await run("INSERT INTO testimonials (patientName, content, rating, isApproved) VALUES (?,?,?,?)", [patientName, content, rating, isApproved || 0]);
        const testimonial = await get("SELECT * FROM testimonials WHERE id = ?", [result.lastID]);
        res.status(201).json(testimonial);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/testimonials/:id', isAuthenticated, async (req, res) => {
    try {
        const { patientName, content, rating, isApproved, isArchived } = req.body;
        await run("UPDATE testimonials SET patientName=?, content=?, rating=?, isApproved=?, isArchived=? WHERE id=?", [patientName, content, rating, isApproved, isArchived, req.params.id]);
        const testimonial = await get("SELECT * FROM testimonials WHERE id = ?", [req.params.id]);
        res.json(testimonial);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/testimonials/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM testimonials WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Department Routes ---
app.get('/api/departments', async (req, res) => {
    try { const depts = await query("SELECT * FROM departments"); res.json(depts); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/departments', isAuthenticated, async (req, res) => {
    try {
        const { name } = req.body;
        const result = await run("INSERT INTO departments (name) VALUES (?)", [name]);
        const dept = await get("SELECT * FROM departments WHERE id = ?", [result.lastID]);
        res.status(201).json(dept);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/departments/:id', isAuthenticated, async (req, res) => {
    try {
        const { name } = req.body;
        await run("UPDATE departments SET name=? WHERE id=?", [name, req.params.id]);
        const dept = await get("SELECT * FROM departments WHERE id = ?", [req.params.id]);
        res.json(dept);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/departments/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM departments WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Package Routes ---
app.get('/api/packages', async (req, res) => {
    try { const packages = await query("SELECT * FROM healthPackages"); res.json(packages); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/packages', isAuthenticated, async (req, res) => {
    try {
        const { title, price, features, isActive } = req.body;
        const result = await run("INSERT INTO healthPackages (title, price, features, isActive) VALUES (?,?,?,?)", [title, price, features, isActive || 1]);
        const pkg = await get("SELECT * FROM healthPackages WHERE id = ?", [result.lastID]);
        res.status(201).json(pkg);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/packages/:id', isAuthenticated, async (req, res) => {
    try {
        const { title, price, features, isActive } = req.body;
        await run("UPDATE healthPackages SET title=?, price=?, features=?, isActive=? WHERE id=?", [title, price, features, isActive, req.params.id]);
        const pkg = await get("SELECT * FROM healthPackages WHERE id = ?", [req.params.id]);
        res.json(pkg);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/packages/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM healthPackages WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FAQ Routes ---
app.get('/api/faqs', async (req, res) => {
    try { const faqs = await query("SELECT * FROM faqs"); res.json(faqs); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/faqs', isAuthenticated, async (req, res) => {
    try {
        const { question, answer } = req.body;
        const result = await run("INSERT INTO faqs (question, answer) VALUES (?,?)", [question, answer]);
        const faq = await get("SELECT * FROM faqs WHERE id = ?", [result.lastID]);
        res.status(201).json(faq);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/faqs/:id', isAuthenticated, async (req, res) => {
    try {
        const { question, answer } = req.body;
        await run("UPDATE faqs SET question=?, answer=? WHERE id=?", [question, answer, req.params.id]);
        const faq = await get("SELECT * FROM faqs WHERE id = ?", [req.params.id]);
        res.json(faq);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/faqs/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM faqs WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Appointment Routes ---
app.get('/api/appointments', isAuthenticated, async (req, res) => {
    try { const appointments = await query("SELECT * FROM appointments"); res.json(appointments); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/appointments', async (req, res) => {
    try {
        const { patientName, patientPhone, patientEmail, department, doctor, date, time, status, notes } = req.body;
        const result = await run("INSERT INTO appointments (patientName, patientPhone, patientEmail, department, doctor, date, time, status, notes) VALUES (?,?,?,?,?,?,?,?,?)", [patientName, patientPhone, patientEmail, department, doctor, date, time, status || 'PENDING', notes || '']);
        const appt = await get("SELECT * FROM appointments WHERE id = ?", [result.lastID]);
        res.status(201).json(appt);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/appointments/:id', isAuthenticated, async (req, res) => {
    try {
        const { patientName, patientPhone, patientEmail, department, doctor, date, time, status, notes } = req.body;
        await run("UPDATE appointments SET patientName=?, patientPhone=?, patientEmail=?, department=?, doctor=?, date=?, time=?, status=?, notes=? WHERE id=?", [patientName, patientPhone, patientEmail, department, doctor, date, time, status, notes, req.params.id]);
        const appt = await get("SELECT * FROM appointments WHERE id = ?", [req.params.id]);
        res.json(appt);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/appointments/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM appointments WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Contact Info ---
app.get('/api/contact', async (req, res) => {
    try { const contact = await get("SELECT * FROM contactInfo LIMIT 1"); res.json(contact || {}); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/contact', isAuthenticated, async (req, res) => {
    try {
        const { address, phone, mobile, emergency, email, hours, mapEmbed } = req.body;
        await run("UPDATE contactInfo SET address=?, phone=?, mobile=?, emergency=?, email=?, hours=?, mapEmbed=? WHERE id=1", [address, phone, mobile, emergency, email, hours, mapEmbed]);
        const contact = await get("SELECT * FROM contactInfo LIMIT 1");
        res.json(contact);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Stats ---
app.get('/api/stats', async (req, res) => {
    try { const stats = await get("SELECT * FROM stats LIMIT 1"); res.json(stats || {}); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/stats', isAuthenticated, async (req, res) => {
    try {
        const { patients, satisfaction, emergency } = req.body;
        await run("UPDATE stats SET patients=?, satisfaction=?, emergency=? WHERE id=1", [patients, satisfaction, emergency]);
        const stats = await get("SELECT * FROM stats LIMIT 1");
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- User management ---
app.get('/api/users', isAuthenticated, async (req, res) => {
    try { const users = await query("SELECT id, username FROM users"); res.json(users); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', isAuthenticated, async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await run("INSERT INTO users (username, password) VALUES (?,?)", [username, password]);
        res.status(201).json({ id: result.lastID, username });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM users WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Change Password ---
app.put('/api/users/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;
    try {
        const user = await get("SELECT * FROM users WHERE id = ?", [userId]);
        if (!user || user.password !== currentPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        await run("UPDATE users SET password = ? WHERE id = ?", [newPassword, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Gallery ---
app.get('/api/gallery', async (req, res) => {
    try { const gallery = await query("SELECT * FROM gallery"); res.json(gallery); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/gallery', isAuthenticated, async (req, res) => {
    try {
        const { title, icon } = req.body;
        const result = await run("INSERT INTO gallery (title, icon) VALUES (?,?)", [title, icon]);
        const item = await get("SELECT * FROM gallery WHERE id = ?", [result.lastID]);
        res.status(201).json(item);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/gallery/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM gallery WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Blogs ---
app.get('/api/blogs', async (req, res) => {
    try { const blogs = await query("SELECT * FROM blogs"); res.json(blogs); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/blogs', isAuthenticated, async (req, res) => {
    try {
        const { title, slug, excerpt, content, publishedAt, isPublished } = req.body;
        const result = await run("INSERT INTO blogs (title, slug, excerpt, content, publishedAt, isPublished) VALUES (?,?,?,?,?,?)", [title, slug, excerpt, content, publishedAt, isPublished || 0]);
        const blog = await get("SELECT * FROM blogs WHERE id = ?", [result.lastID]);
        res.status(201).json(blog);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/blogs/:id', isAuthenticated, async (req, res) => {
    try {
        const { title, slug, excerpt, content, publishedAt, isPublished } = req.body;
        await run("UPDATE blogs SET title=?, slug=?, excerpt=?, content=?, publishedAt=?, isPublished=? WHERE id=?", [title, slug, excerpt, content, publishedAt, isPublished, req.params.id]);
        const blog = await get("SELECT * FROM blogs WHERE id = ?", [req.params.id]);
        res.json(blog);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/blogs/:id', isAuthenticated, async (req, res) => {
    try { await run("DELETE FROM blogs WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve frontend
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔑 Admin login: admin / 12345`);
});