const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',           // Next.js local
    'http://localhost:5000',           // যদি আলাদা পোর্টে frontend চলে
    'https://hishabi-api.vercel.app/hishab', // production frontend domain (পরিবর্তন করুন)
    '*'                                // dev-এর জন্য temporarily সব allow (পরে restrict করুন)
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer setup (memory storage – Vercel compatible)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .jpeg, .png, .webp allowed'), false);
    }
  },
});

// MongoDB connection (cached for serverless)
const uri = process.env.MONGODB_URI || "mongodb+srv://ifter:ifter2026@ifter1.e6wwged.mongodb.net/ifterDB?retryWrites=true&w=majority";

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    console.log('Using cached MongoDB connection');
    return cachedDb;
  }

  try {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();
    console.log('MongoDB connected successfully (new connection)');
    cachedDb = client.db('ifterDB');
    return cachedDb;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

// Routes
app.get('/', (req, res) => {
  res.send('Server is running 🚀 | Ifter Hisab API');
});

// POST /hishab
app.post(
  '/hishab',
  upload.fields([
    { name: 'donorImage', maxCount: 1 },
    { name: 'receiverImage', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      console.log('POST /hishab received');
      console.log('Body:', req.body);
      console.log('Files received:', req.files ? Object.keys(req.files) : 'No files');

      const db = await connectToDatabase();
      const body = req.body;
      const files = req.files || {};

      // Dummy URL – পরে Cloudinary / Vercel Blob / ImgBB দিয়ে replace করুন
      const donorImageUrl = files.donorImage?.[0]
        ? `https://via.placeholder.com/150?text=${encodeURIComponent(body.donorName || 'Donor')}`
        : null;

      const receiverImageUrl = files.receiverImage?.[0]
        ? `https://via.placeholder.com/150?text=${encodeURIComponent(body.receiverName || 'Receiver')}`
        : null;

      const newTransaction = {
        type: body.type || 'donation',
        amount: Number(body.amount) || 0,
        note: (body.note || body.description || body.reason || '').trim(),
        date: body.date || new Date().toISOString().split('T')[0],

        donorName: (body.donorName || '').trim(),
        donorPhone: (body.donorPhone || '').trim(),
        donorAddress: (body.donorAddress || '').trim(),
        donorImage: donorImageUrl,

        receiverName: (body.receiverName || '').trim(),
        receiverPhone: (body.receiverPhone || '').trim(),
        receiverAddress: (body.receiverAddress || '').trim(),
        receiverImage: receiverImageUrl,

        createdAt: new Date(),
      };

      const result = await db.collection('hishab').insertOne(newTransaction);

      res.status(201).json({
        success: true,
        insertedId: result.insertedId.toString(),
        message: 'Transaction added successfully'
      });
    } catch (err) {
      console.error('POST /hishab error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /hishab
app.get('/hishab', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const transactions = await db.collection('hishab')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    let totalDonation = 0;
    let totalExpense = 0;

    const processed = transactions.map(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'donation') totalDonation += amt;
      if (t.type === 'expense') totalExpense += amt;

      return {
        ...t,
        _id: t._id.toString(),
        id: t._id.toString(),
        amount: amt,
        note: t.note || '',
      };
    });

    res.json({
      transactions: processed,
      totalDonation,
      totalExpense,
      netBalance: totalDonation - totalExpense
    });
  } catch (err) {
    console.error('GET /hishab error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /hishab/:id
app.delete('/hishab/:id', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection('hishab').deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error('DELETE error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Vercel serverless এর জন্য
module.exports = app;

// লোকাল ডেভেলপমেন্টের জন্য listen (Vercel এ ignore হবে)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`GET  → http://localhost:${PORT}/hishab`);
    console.log(`POST → http://localhost:${PORT}/hishab`);
  });
}