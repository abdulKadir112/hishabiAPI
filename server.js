const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();

// Improved CORS setup – Vercel-এর জন্য reliable
app.use(cors({
  origin: '*',  // Test-এর জন্য * ; পরে specific origin দাও যেমন 'https://hishabi.vercel.app'
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Explicit OPTIONS handler for preflight (Vercel edge-এ দরকার)
app.options('*', cors());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .jpeg, .png, .webp allowed'), false);
    }
  },
});

// MongoDB URI from env (fallback for local)
const uri = process.env.MONGODB_URI || "mongodb+srv://ifter:ifter2026@ifter1.e6wwged.mongodb.net/ifterDB?retryWrites=true&w=majority";

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    console.log('Using cached MongoDB connection');
    return cachedDb;
  }

  console.log('Attempting new MongoDB connection...');
  console.log('MONGODB_URI present:', !!process.env.MONGODB_URI);

  try {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 30000,          // 30s timeout
      serverSelectionTimeoutMS: 30000,  // Server select timeout
      socketTimeoutMS: 45000,           // Socket timeout
    });

    await client.connect();
    console.log('MongoDB connected successfully (new connection)');
    cachedDb = client.db('ifterDB');
    return cachedDb;
  } catch (err) {
    console.error('MongoDB connection FAILED:', err.message);
    console.error('Full error:', err);
    if (err.name === 'MongoServerSelectionError') {
      console.error('Likely IP whitelist issue or wrong URI');
    }
    throw err;
  }
}

// Routes
app.get('/', (req, res) => {
  res.send('Server is running 🚀 | Ifter Hisab API');
});

// GET /hishab with better logging
app.get('/hishab', async (req, res) => {
  console.log('GET /hishab requested');
  try {
    const db = await connectToDatabase();
    console.log('DB connection successful in GET /hishab');

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

    console.log(`Fetched ${processed.length} transactions`);
    res.json({
      transactions: processed,
      totalDonation,
      totalExpense,
      netBalance: totalDonation - totalExpense
    });
  } catch (err) {
    console.error('GET /hishab error:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Server error', 
      message: err.message,
      details: 'Check Vercel logs for full stack'
    });
  }
});

// POST /hishab (আগের মতো রাখলাম, log improve)
app.post(
  '/hishab',
  upload.fields([
    { name: 'donorImage', maxCount: 1 },
    { name: 'receiverImage', maxCount: 1 }
  ]),
  async (req, res) => {
    console.log('POST /hishab received');
    try {
      const db = await connectToDatabase();
      const body = req.body;
      const files = req.files || {};

      // ... (বাকি তোমার code একই রাখলাম)

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

// DELETE route (একই রাখলাম)
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

// Vercel serverless export
module.exports = app;

// Local dev only
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}