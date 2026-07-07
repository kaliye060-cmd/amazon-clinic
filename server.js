const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory database (works 100% of the time)
const db = {
    users: [{ id: 1, username: 'admin', password: '12345' }],
    doctors: [],
    services: [],
    testimonials: [],
    departments: [],
    healthPackages: [],
    faqs: [],
    gallery: [],
    blogs: [],
    appointments: [],
    contactInfo: {
        id: 1,
        address: 'Arba Minch, Ethiopia',
        phone: '046 899 7555',
        mobile: '0912 036 550',
        emergency: '046 899 7555',
        email: 'contact@amazonclinic.com',
        hours: '24 Hours · 7 Days a Week',
        mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d31876.97507892743!2d37.540985!3d6.033333!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x17b0f5e8a3b4c8b7%3A0x8b3c4d5e6f7a8b9c!2sArba%20Minch%2C%20Ethiopia!5e0!3m2!1sen!2s!4v1700000000000'
    },
    stats: { id: 1, patients: '10K+', satisfaction: '98%', emergency: '24/7' },
    nextId: 100
};

// Helper functions
function findById(collection, id) {
    return collection.find(item => item.id === id);
}

function generateId() {
    return db.nextId++;
}

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

// ---- AUTH ROUTES ----
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = { id: user.id, username: user.username };
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// ---- DOCTORS ----
app.get('/api/doctors', (req, res) => {
    res.json(db.doctors);
});

app.post('/api/doctors', isAuthenticated, (req, res) => {
    const doctor = { id: generateId(), ...req.body, isAvailable: req.body.isAvailable || 1, isFeatured: req.body.isFeatured || 0, isArchived: 0 };
    db.doctors.push(doctor);
    res.status(201).json(doctor);
});

app.put('/api/doctors/:id', isAuthenticated, (req, res) => {
    const index = db.doctors.findIndex(d => d.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.doctors[index] = { ...db.doctors[index], ...req.body };
    res.json(db.doctors[index]);
});

app.delete('/api/doctors/:id', isAuthenticated, (req, res) => {
    db.doctors = db.doctors.filter(d => d.id != req.params.id);
    res.json({ success: true });
});

// ---- SERVICES ----
app.get('/api/services', (req, res) => {
    res.json(db.services);
});

app.post('/api/services', isAuthenticated, (req, res) => {
    const service = { id: generateId(), ...req.body, isActive: req.body.isActive || 1 };
    db.services.push(service);
    res.status(201).json(service);
});

app.put('/api/services/:id', isAuthenticated, (req, res) => {
    const index = db.services.findIndex(s => s.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.services[index] = { ...db.services[index], ...req.body };
    res.json(db.services[index]);
});

app.delete('/api/services/:id', isAuthenticated, (req, res) => {
    db.services = db.services.filter(s => s.id != req.params.id);
    res.json({ success: true });
});

// ---- TESTIMONIALS ----
app.get('/api/testimonials', (req, res) => {
    res.json(db.testimonials);
});

app.post('/api/testimonials', isAuthenticated, (req, res) => {
    const testimonial = { id: generateId(), ...req.body, isApproved: req.body.isApproved || 0, isArchived: 0 };
    db.testimonials.push(testimonial);
    res.status(201).json(testimonial);
});

app.put('/api/testimonials/:id', isAuthenticated, (req, res) => {
    const index = db.testimonials.findIndex(t => t.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.testimonials[index] = { ...db.testimonials[index], ...req.body };
    res.json(db.testimonials[index]);
});

app.delete('/api/testimonials/:id', isAuthenticated, (req, res) => {
    db.testimonials = db.testimonials.filter(t => t.id != req.params.id);
    res.json({ success: true });
});

// ---- DEPARTMENTS ----
app.get('/api/departments', (req, res) => {
    res.json(db.departments);
});

app.post('/api/departments', isAuthenticated, (req, res) => {
    const dept = { id: generateId(), name: req.body.name };
    db.departments.push(dept);
    res.status(201).json(dept);
});

app.put('/api/departments/:id', isAuthenticated, (req, res) => {
    const index = db.departments.findIndex(d => d.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.departments[index] = { ...db.departments[index], ...req.body };
    res.json(db.departments[index]);
});

app.delete('/api/departments/:id', isAuthenticated, (req, res) => {
    db.departments = db.departments.filter(d => d.id != req.params.id);
    res.json({ success: true });
});

// ---- HEALTH PACKAGES ----
app.get('/api/packages', (req, res) => {
    res.json(db.healthPackages);
});

app.post('/api/packages', isAuthenticated, (req, res) => {
    const pkg = { id: generateId(), ...req.body, isActive: req.body.isActive || 1 };
    db.healthPackages.push(pkg);
    res.status(201).json(pkg);
});

app.put('/api/packages/:id', isAuthenticated, (req, res) => {
    const index = db.healthPackages.findIndex(p => p.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.healthPackages[index] = { ...db.healthPackages[index], ...req.body };
    res.json(db.healthPackages[index]);
});

app.delete('/api/packages/:id', isAuthenticated, (req, res) => {
    db.healthPackages = db.healthPackages.filter(p => p.id != req.params.id);
    res.json({ success: true });
});

// ---- FAQS ----
app.get('/api/faqs', (req, res) => {
    res.json(db.faqs);
});

app.post('/api/faqs', isAuthenticated, (req, res) => {
    const faq = { id: generateId(), question: req.body.question, answer: req.body.answer };
    db.faqs.push(faq);
    res.status(201).json(faq);
});

app.put('/api/faqs/:id', isAuthenticated, (req, res) => {
    const index = db.faqs.findIndex(f => f.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.faqs[index] = { ...db.faqs[index], ...req.body };
    res.json(db.faqs[index]);
});

app.delete('/api/faqs/:id', isAuthenticated, (req, res) => {
    db.faqs = db.faqs.filter(f => f.id != req.params.id);
    res.json({ success: true });
});

// ---- APPOINTMENTS ----
app.get('/api/appointments', isAuthenticated, (req, res) => {
    res.json(db.appointments);
});

app.post('/api/appointments', (req, res) => {
    const appt = { id: generateId(), ...req.body, status: req.body.status || 'PENDING' };
    db.appointments.push(appt);
    res.status(201).json(appt);
});

app.put('/api/appointments/:id', isAuthenticated, (req, res) => {
    const index = db.appointments.findIndex(a => a.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.appointments[index] = { ...db.appointments[index], ...req.body };
    res.json(db.appointments[index]);
});

app.delete('/api/appointments/:id', isAuthenticated, (req, res) => {
    db.appointments = db.appointments.filter(a => a.id != req.params.id);
    res.json({ success: true });
});

// ---- CONTACT INFO ----
app.get('/api/contact', (req, res) => {
    res.json(db.contactInfo);
});

app.put('/api/contact', isAuthenticated, (req, res) => {
    db.contactInfo = { ...db.contactInfo, ...req.body };
    res.json(db.contactInfo);
});

// ---- STATS ----
app.get('/api/stats', (req, res) => {
    res.json(db.stats);
});

app.put('/api/stats', isAuthenticated, (req, res) => {
    db.stats = { ...db.stats, ...req.body };
    res.json(db.stats);
});

// ---- USERS ----
app.get('/api/users', isAuthenticated, (req, res) => {
    res.json(db.users.map(u => ({ id: u.id, username: u.username })));
});

app.post('/api/users', isAuthenticated, (req, res) => {
    const user = { id: generateId(), username: req.body.username, password: req.body.password };
    db.users.push(user);
    res.status(201).json({ id: user.id, username: user.username });
});

app.delete('/api/users/:id', isAuthenticated, (req, res) => {
    db.users = db.users.filter(u => u.id != req.params.id);
    res.json({ success: true });
});

// ---- CHANGE PASSWORD ----
app.put('/api/users/change-password', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.password !== req.body.currentPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
    }
    user.password = req.body.newPassword;
    res.json({ success: true });
});

// ---- GALLERY ----
app.get('/api/gallery', (req, res) => {
    res.json(db.gallery);
});

app.post('/api/gallery', isAuthenticated, (req, res) => {
    const item = { id: generateId(), title: req.body.title, icon: req.body.icon || 'fa-image' };
    db.gallery.push(item);
    res.status(201).json(item);
});

app.delete('/api/gallery/:id', isAuthenticated, (req, res) => {
    db.gallery = db.gallery.filter(g => g.id != req.params.id);
    res.json({ success: true });
});

// ---- BLOGS ----
app.get('/api/blogs', (req, res) => {
    res.json(db.blogs);
});

app.post('/api/blogs', isAuthenticated, (req, res) => {
    const blog = { id: generateId(), ...req.body, isPublished: req.body.isPublished || 0 };
    db.blogs.push(blog);
    res.status(201).json(blog);
});

app.put('/api/blogs/:id', isAuthenticated, (req, res) => {
    const index = db.blogs.findIndex(b => b.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.blogs[index] = { ...db.blogs[index], ...req.body };
    res.json(db.blogs[index]);
});

app.delete('/api/blogs/:id', isAuthenticated, (req, res) => {
    db.blogs = db.blogs.filter(b => b.id != req.params.id);
    res.json({ success: true });
});

// Serve frontend
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔑 Admin login: admin / 12345`);
    console.log(`📊 Database: In-memory (no file permissions!)`);
});